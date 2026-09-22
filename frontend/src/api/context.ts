import { api } from "./client";
import type { RouteContextResponse } from "./types";

export async function getRouteContext(
  routeId: string,
): Promise<RouteContextResponse> {
  return api<RouteContextResponse>(
    `/routes/${encodeURIComponent(routeId)}/context`,
    {
      method: "GET",
    },
    false,
  );
}
