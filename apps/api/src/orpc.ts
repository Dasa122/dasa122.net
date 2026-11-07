import { appContract } from "@dasa122/contract";
import { implement } from "@orpc/server";
import type { ApiContext } from "./middleware/context";

/**
 * The oRPC procedure base. Every procedure in `router.ts` is built from this,
 * so implementations are type-checked against `appContract` and carry the
 * shared `ApiContext` and error map.
 */
export const base = implement(appContract).$context<ApiContext>();
