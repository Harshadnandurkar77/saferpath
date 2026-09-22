import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapStyle } from "./mapStyle";
import type { MapHelpPoint, MapRoute } from "./mapTypes";

const routeFeature = (route: MapRoute) => ({
  type: "Feature" as const,
  properties: { id: route.id, context: route.context },
  geometry: { type: "LineString" as const, coordinates: route.coordinates },
});

const collection = (features: ReturnType<typeof routeFeature>[]) => ({
  type: "FeatureCollection" as const,
  features,
});

export interface SaferPathMapProps {
  routes: MapRoute[];
  selectedRoute: string;
  helpPoints: MapHelpPoint[];
  onSelectRoute?: (id: string) => void;
  onSelectHelp?: (id: string) => void;
  className?: string;
  breadcrumbCoordinates?: [number, number][];
  currentLocation?: [number, number] | null;
  originPoint?: [number, number] | null;
  destinationPoint?: [number, number] | null;
}

export function SaferPathMap({
  routes,
  selectedRoute,
  helpPoints,
  onSelectRoute,
  onSelectHelp,
  className = "",
  breadcrumbCoordinates = [],
  currentLocation = null,
  originPoint = null,
  destinationPoint = null,
}: SaferPathMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: mapStyle,
      center: [72.835, 19.057], // Bandra West / Mumbai Pilot corridor center
      zoom: 13,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      // 1. Routes source & layers
      map.addSource("sp-routes", { type: "geojson", data: collection([]) });

      // Alternative routes (muted dashed)
      map.addLayer({
        id: "sp-route-alt",
        type: "line",
        source: "sp-routes",
        filter: ["!=", ["get", "id"], selectedRoute],
        paint: {
          "line-color": "#8b9c94",
          "line-width": 4.5,
          "line-opacity": 0.65,
          "line-dasharray": [2, 1.5],
        },
      });

      // Selected route (prominent teal with subtle casing)
      map.addLayer({
        id: "sp-route-selected-casing",
        type: "line",
        source: "sp-routes",
        filter: ["==", ["get", "id"], selectedRoute],
        paint: {
          "line-color": "#0d4e48",
          "line-width": 9,
          "line-opacity": 0.4,
        },
      });
      map.addLayer({
        id: "sp-route-selected",
        type: "line",
        source: "sp-routes",
        filter: ["==", ["get", "id"], selectedRoute],
        paint: {
          "line-color": "#16756c",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });

      // 2. Traveled Breadcrumbs line
      map.addSource("sp-breadcrumb", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        },
      });
      map.addLayer({
        id: "sp-breadcrumb-line",
        type: "line",
        source: "sp-breadcrumb",
        paint: {
          "line-color": "#0284c7",
          "line-width": 4,
          "line-opacity": 0.85,
        },
      });

      // 3. Endpoints (Origin & Destination)
      map.addSource("sp-endpoints", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "sp-endpoints-circle",
        type: "circle",
        source: "sp-endpoints",
        paint: {
          "circle-radius": 7,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // 4. Live GPS Location Marker
      map.addSource("sp-current-location", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "sp-location-halo",
        type: "circle",
        source: "sp-current-location",
        paint: {
          "circle-radius": 14,
          "circle-color": "#0284c7",
          "circle-opacity": 0.25,
        },
      });
      map.addLayer({
        id: "sp-location-dot",
        type: "circle",
        source: "sp-current-location",
        paint: {
          "circle-radius": 6.5,
          "circle-color": "#0284c7",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
        },
      });

      // 5. Help Points
      map.addSource("sp-help", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "sp-help-points",
        type: "circle",
        source: "sp-help",
        paint: {
          "circle-radius": 7,
          "circle-color": "#fffefb",
          "circle-stroke-color": "#16756c",
          "circle-stroke-width": 3,
        },
      });

      // Interactive click handlers
      map.on("click", "sp-route-alt", (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id && onSelectRoute) onSelectRoute(id);
      });
      map.on("click", "sp-route-selected", (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id && onSelectRoute) onSelectRoute(id);
      });
      map.on("click", "sp-help-points", (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id && onSelectHelp) onSelectHelp(id);
      });

      map.on("mouseenter", "sp-route-alt", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "sp-route-alt", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "sp-help-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "sp-help-points", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onSelectHelp, onSelectRoute, selectedRoute]);

  // Update routes, help points, endpoints, breadcrumb and location
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Update routes
    const routeSource = map.getSource("sp-routes") as GeoJSONSource | undefined;
    routeSource?.setData(collection(routes.map(routeFeature)));

    // Update help points
    const helpSource = map.getSource("sp-help") as GeoJSONSource | undefined;
    helpSource?.setData({
      type: "FeatureCollection",
      features: helpPoints.map((x) => ({
        type: "Feature" as const,
        properties: { id: x.id },
        geometry: { type: "Point" as const, coordinates: x.coordinate },
      })),
    });

    // Update selection filters
    if (map.getLayer("sp-route-selected")) {
      map.setFilter("sp-route-selected", ["==", ["get", "id"], selectedRoute]);
      map.setFilter("sp-route-selected-casing", [
        "==",
        ["get", "id"],
        selectedRoute,
      ]);
      map.setFilter("sp-route-alt", ["!=", ["get", "id"], selectedRoute]);
    }

    // Update endpoints
    const endpSource = map.getSource("sp-endpoints") as
      | GeoJSONSource
      | undefined;
    const endpFeatures: {
      type: "Feature";
      properties: { color: string };
      geometry: { type: "Point"; coordinates: [number, number] };
    }[] = [];
    if (originPoint) {
      endpFeatures.push({
        type: "Feature",
        properties: { color: "#16756c" },
        geometry: { type: "Point", coordinates: originPoint },
      });
    }
    if (destinationPoint) {
      endpFeatures.push({
        type: "Feature",
        properties: { color: "#b6433d" },
        geometry: { type: "Point", coordinates: destinationPoint },
      });
    }
    endpSource?.setData({
      type: "FeatureCollection",
      features: endpFeatures,
    });

    // Update breadcrumb
    const breadcrumbSource = map.getSource("sp-breadcrumb") as
      | GeoJSONSource
      | undefined;
    breadcrumbSource?.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: breadcrumbCoordinates,
      },
    });

    // Update live location
    const locSource = map.getSource("sp-current-location") as
      | GeoJSONSource
      | undefined;
    if (currentLocation) {
      locSource?.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: currentLocation },
          },
        ],
      });
    } else {
      locSource?.setData({ type: "FeatureCollection", features: [] });
    }

    // Auto-fit bounds if we have routes
    const activeRoute = routes.find((r) => r.id === selectedRoute);
    if (activeRoute && activeRoute.coordinates.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      activeRoute.coordinates.forEach((coord) => bounds.extend(coord));
      if (currentLocation) bounds.extend(currentLocation);
      map.fitBounds(bounds, { padding: 45, maxZoom: 15, duration: 1000 });
    }
  }, [
    routes,
    helpPoints,
    selectedRoute,
    breadcrumbCoordinates,
    currentLocation,
    originPoint,
    destinationPoint,
  ]);

  return (
    <div
      className={`relative overflow-hidden border border-[#bdc9c0] ${className}`}
    >
      <div
        ref={container}
        className="h-full w-full"
        aria-label="Interactive route map"
      />

      {/* Map legend overlay */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded border border-[#d8ddd7] bg-[#fffefb]/95 p-2.5 text-[11px] shadow-sm backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-full bg-[#16756c]" />
          <span className="font-medium text-[#14231d]">Selected corridor</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-[#8b9c94]" />
          <span className="text-[#53615a]">Alternative paths</span>
        </div>
        {breadcrumbCoordinates.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-4 rounded-full bg-[#0284c7]" />
            <span className="text-[#0284c7]">Traveled path</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#16756c] bg-[#fffefb]" />
          <span className="text-[#53615a]">Help facilities</span>
        </div>
      </div>

      {/* Map Controls */}
      <div className="absolute right-3 top-3 flex flex-col border border-[#d8ddd7] bg-[#fffefb] shadow-sm">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="h-9 w-9 text-lg font-bold text-[#14231d] hover:bg-[#f0f2ed]"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="h-9 w-9 border-t border-[#d8ddd7] text-lg font-bold text-[#14231d] hover:bg-[#f0f2ed]"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => {
            if (currentLocation && mapRef.current) {
              mapRef.current.flyTo({ center: currentLocation, zoom: 15 });
            } else {
              mapRef.current?.flyTo({ center: [72.835, 19.057], zoom: 13 });
            }
          }}
          className="h-9 w-9 border-t border-[#d8ddd7] text-xs font-semibold text-[#16756c] hover:bg-[#f0f2ed]"
          aria-label="Recenter map"
        >
          ◎
        </button>
      </div>
    </div>
  );
}
