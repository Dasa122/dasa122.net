import z from "zod";

/**
 * Machine-readable error codes for the dasa122.net API. Every procedure
 * answers with one of these: the code travels over the wire in the oRPC
 * error payload and is what clients branch on
 * (`isDefinedError(error) && error.code === 'CONFLICT'`).
 *
 * The contract installs this map once at the root
 * (`oc.errors(apiErrors)`), which cascades its status, default message and
 * documented error response onto every procedure in the router tree.
 */
export const apiErrors = {
  BAD_REQUEST: { message: "Validation failed", status: 400 },
  CONFLICT: { message: "Conflict", status: 409 },
  FORBIDDEN: { message: "Forbidden", status: 403 },
  INTEGRATION_UNAVAILABLE: {
    message: "Integration unavailable",
    status: 503,
  },
  INTERNAL: { message: "Internal Server Error", status: 500 },
  NOT_FOUND: { message: "Not found", status: 404 },
  RATE_LIMITED: {
    data: z.object({ retryAfter: z.coerce.number().optional() }),
    message: "Too many requests",
    status: 429,
  },
  UNAUTHORIZED: { message: "Unauthorized", status: 401 },
  UNKNOWN: { message: "Unknown error", status: 500 },
  VALIDATION: { message: "Validation failed", status: 400 },
} as const satisfies Record<
  string,
  { message: string; status: number; data?: z.ZodType }
>;
