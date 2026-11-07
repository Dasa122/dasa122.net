import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { appContract } from "../contract";

export interface ApiClientOptions {
  url: string | (() => string | Promise<string>);
  credentials?: "include" | "omit" | "same-origin";
  headers?: () => Headers;
}

export function createApiClient(options: ApiClientOptions) {
  const link = new RPCLink({
    fetch: (request, init) =>
      fetch(request, {
        ...init,
        credentials: options.credentials ?? "same-origin",
      }),
    ...(options.headers ? { headers: options.headers } : {}),
    url: options.url,
  });
  const client: ContractRouterClient<typeof appContract> =
    createORPCClient(link);
  return { client, orpc: createTanstackQueryUtils(client) };
}
