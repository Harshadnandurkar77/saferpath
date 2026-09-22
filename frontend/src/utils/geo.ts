function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function distanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Radius of the earth in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): string {
  const d = distanceInMeters(lat1, lon1, lat2, lon2);
  if (d < 1000) {
    return `${Math.round(d)} m`;
  }
  return `${(d / 1000).toFixed(1)} km`;
}

/**
 * Calculates perpendicular distance in meters from point P to line segment AB
 */
export function distanceToSegment(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const dAB = distanceInMeters(aLat, aLon, bLat, bLon);
  if (dAB === 0) return distanceInMeters(pLat, pLon, aLat, aLon);

  // Approximate flat-earth projection for short distances (typical urban segments)
  const meanLat = (aLat + bLat) / 2;
  const kx = Math.cos(deg2rad(meanLat)) * 111320;
  const ky = 110540;

  const px = (pLon - aLon) * kx;
  const py = (pLat - aLat) * ky;
  const bx = (bLon - aLon) * kx;
  const by = (bLat - aLat) * ky;

  const dot = px * bx + py * by;
  const lenSq = bx * bx + by * by;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx: number;
  let yy: number;

  if (param < 0) {
    xx = 0;
    yy = 0;
  } else if (param > 1) {
    xx = bx;
    yy = by;
  } else {
    xx = param * bx;
    yy = param * by;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Finds minimum distance in meters from point P to any segment in a polyline coordinates array [lon, lat][]
 */
export function distanceToRoute(
  pLat: number,
  pLon: number,
  routeCoords: [number, number][],
): number {
  if (!routeCoords || routeCoords.length < 2) return 0;
  let minDistance = Infinity;

  for (let i = 0; i < routeCoords.length - 1; i++) {
    const [aLon, aLat] = routeCoords[i];
    const [bLon, bLat] = routeCoords[i + 1];
    const dist = distanceToSegment(pLat, pLon, aLat, aLon, bLat, bLon);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}
