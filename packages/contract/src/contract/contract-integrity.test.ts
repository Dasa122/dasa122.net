import { describe, expect, test } from "bun:test";
import { apiErrors } from "../errors";
import { appContract } from "./index";

/**
 * Structural invariants of the whole contract. These are the things a later
 * task can break silently by adding a procedure with a missing route or a
 * duplicated `operationId` — the type system accepts both, the OpenAPI
 * document and the HTTP dispatch do not.
 */

type ContractRoute = {
  method?: unknown;
  operationId?: unknown;
  path?: unknown;
};

type ContractLeaf = {
  "~orpc": {
    errorMap?: Record<string, { message?: unknown; status?: unknown }>;
    route?: ContractRoute;
  };
};

type LeafEntry = { leaf: ContractLeaf; path: string };

function isLeaf(node: unknown): node is ContractLeaf {
  return typeof node === "object" && node !== null && "~orpc" in node;
}

/** Depth-first walk over the nested router object, collecting every leaf. */
function collectLeaves(
  node: unknown,
  prefix: readonly string[],
  leaves: LeafEntry[],
): void {
  if (isLeaf(node)) {
    leaves.push({ leaf: node, path: prefix.join(".") });
    return;
  }
  if (typeof node !== "object" || node === null) {
    return;
  }
  const record = node as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    collectLeaves(record[key], [...prefix, key], leaves);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

const leaves: LeafEntry[] = [];
collectLeaves(appContract, [], leaves);

describe("contract integrity", () => {
  test("the walk reaches the known procedures", () => {
    const paths = leaves.map((entry) => entry.path);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths).toContain("posts.list");
    expect(paths).toContain("adminStats.get");
    expect(paths).toContain("health.check");
  });

  test("every procedure carries a method, a path and an operationId", () => {
    const incomplete = leaves
      .filter(({ leaf }) => {
        const route = leaf["~orpc"].route;
        return (
          !isNonEmptyString(route?.method) ||
          !isNonEmptyString(route?.path) ||
          !route.path.startsWith("/") ||
          !isNonEmptyString(route.operationId)
        );
      })
      .map((entry) => entry.path);

    expect(incomplete).toEqual([]);
  });

  test("every operationId is unique across the whole contract", () => {
    const owners = new Map<string, string[]>();
    for (const { leaf, path } of leaves) {
      const operationId = leaf["~orpc"].route?.operationId;
      if (!isNonEmptyString(operationId)) {
        continue;
      }
      owners.set(operationId, [...(owners.get(operationId) ?? []), path]);
    }

    const duplicates = [...owners.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([operationId, paths]) => `${operationId}: ${paths.join(", ")}`);

    expect(duplicates).toEqual([]);
  });

  test("the root error map reaches every leaf", () => {
    const codes = Object.keys(apiErrors) as Array<keyof typeof apiErrors>;

    const missing = leaves
      .filter(({ leaf }) => {
        const errorMap = leaf["~orpc"].errorMap ?? {};
        return codes.some((code) => {
          const expected = apiErrors[code];
          const actual = errorMap[code];
          return (
            actual?.message !== expected.message ||
            actual.status !== expected.status
          );
        });
      })
      .map((entry) => entry.path);

    expect(missing).toEqual([]);
  });
});
