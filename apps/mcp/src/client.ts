import type { McpConfig } from "./config";

export type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST";

/** A failed request, carrying enough context to tell the agent how to recover. */
export class McpError extends Error {
  readonly code: string | undefined;
  readonly status: number;
  readonly suggestion: string | undefined;

  constructor(
    message: string,
    details: { code?: string; status: number; suggestion?: string },
  ) {
    super(message);
    this.name = "McpError";
    this.code = details.code;
    this.status = details.status;
    this.suggestion = details.suggestion;
  }
}

type ValidationIssue = { message?: unknown; path?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractIssues(payload: unknown): ValidationIssue[] {
  if (!isRecord(payload)) {
    return [];
  }
  const fromData = isRecord(payload.data) ? payload.data.issues : undefined;
  const issues = Array.isArray(fromData) ? fromData : payload.issues;
  return Array.isArray(issues) ? (issues as ValidationIssue[]) : [];
}

function formatIssues(issues: ValidationIssue[]): string {
  return issues
    .map((issue) => {
      const path = Array.isArray(issue.path) ? issue.path.join(".") : "";
      const message =
        typeof issue.message === "string" ? issue.message : "invalid value";
      return path === "" ? message : `${path}: ${message}`;
    })
    .join("; ");
}

function suggestionFor(
  status: number,
  issues: ValidationIssue[],
): string | undefined {
  if (status === 401 || status === 403) {
    return "check DASA_MCP_TOKEN";
  }
  if (status === 404) {
    return "check the id";
  }
  if ((status === 400 || status === 422) && issues.length > 0) {
    return `validation failed: ${formatIssues(issues)}`;
  }
  return undefined;
}

/** Builds the one-call HTTP surface shared by every tool. */
export function createClient(config: McpConfig) {
  async function request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${config.token}`,
    };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }

    const response = await fetch(`${config.apiUrl}/api${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
      method,
      signal: AbortSignal.timeout(15_000),
    });

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text === "" ? undefined : JSON.parse(text);
    } catch {
      payload = undefined;
    }

    if (!response.ok) {
      const record = isRecord(payload) ? payload : undefined;
      const message =
        typeof record?.message === "string"
          ? record.message
          : response.statusText;
      const code =
        typeof record?.code === "string"
          ? record.code
          : typeof record?.error === "string"
            ? record.error
            : undefined;
      const issues = extractIssues(payload);
      const suggestion = suggestionFor(response.status, issues);
      const summary = `${response.status} ${response.statusText || "error"}: ${message}${
        code === undefined ? "" : ` [${code}]`
      }${suggestion === undefined ? "" : `. Suggestion: ${suggestion}`}`;
      throw new McpError(summary, {
        code,
        status: response.status,
        suggestion,
      });
    }

    return payload as T;
  }

  return { request };
}

export type ApiClient = ReturnType<typeof createClient>;
