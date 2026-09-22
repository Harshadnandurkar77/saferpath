import { api } from "./client";
import type { HelpPointResponse, NearbyHelpPointsParams } from "./types";

export async function getNearbyHelpPoints(
  params: NearbyHelpPointsParams,
): Promise<HelpPointResponse[]> {
  const query = new URLSearchParams({
    latitude: params.latitude.toString(),
    longitude: params.longitude.toString(),
    radius_meters: params.radius_meters.toString(),
  });

  if (params.category) query.set("category", params.category);
  if (params.accessibility) query.set("accessibility", params.accessibility);
  if (params.verified_only !== undefined)
    query.set("verified_only", params.verified_only.toString());

  return api<HelpPointResponse[]>(
    `/help-points/nearby?${query.toString()}`,
    {
      method: "GET",
    },
    false,
  );
}
