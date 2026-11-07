import { createApiClient } from "@dasa122/contract";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { fallbackApiOrigin, requestOrigin } from "./request";

export const apiBaseUrl = "/api";

const client = createIsomorphicFn()
  .client(() =>
    createApiClient({
      credentials: "same-origin",
      url: () => `${window.location.origin}${apiBaseUrl}/rpc`,
    }),
  )
  .server(() =>
    createApiClient({
      headers: () => new Headers(getRequestHeaders()),
      url: () => `${requestOrigin() ?? fallbackApiOrigin}${apiBaseUrl}/rpc`,
    }),
  )();

export const { client: rpcClient, orpc } = client;
export const api = rpcClient;
