import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMapStyle } from "./mapStyle";
import { useTheme } from "../../context/ThemeContext";
import type { MapHelpPoint, MapRoute } from "./mapTypes";

// ── GeoJSON helpers ─────────────────────────────────────────────────────────

const routeFeature = (route: MapRoute) => ({
  type: "Feature" as const,
  properties: { id: route.id, context: route.context },
  geometry: { type: "LineString" as const, coordinates: route.coordinates },
});

const collection = (features: ReturnType<typeof routeFeature>[]) => ({
  type: "FeatureCollection" as const,
  features,
});

// ── Component interface ──────────────────────────────────────────────────────

export interface SaferPathMapProps {
  routes: MapRoute[];
  selectedRoute: string;
  helpPoints: MapHelpPoint[];
  onSelectRoute?: (id: string) => void;
  onSelectHelp?: (id: string) => void;
  selectedHelpPoint?: string | null;
  className?: string;
  breadcrumbCoordinates?: [number, number][];
  currentLocation?: [number, number] | null;
  originPoint?: [number, number] | null;
  destinationPoint?: [number, number] | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SaferPathMap({
  routes,
  selectedRoute,
  helpPoints,
  onSelectRoute,
  onSelectHelp,
  selectedHelpPoint = null,
  className = "",
  breadcrumbCoordinates = [],
  currentLocation = null,
  originPoint = null,
  destinationPoint = null,
}: SaferPathMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Pending data to apply once map loads
  const pendingSync = useRef<boolean>(false);

  const { theme } = useTheme();

  // Helper: add all sources + layers (after style reload)
  const addSourcesAndLayers = useCallback((map: MapLibreMap) => {
    // Routes
    map.addSource("sp-routes", { type: "geojson", data: collection([]) });
    map.addLayer({
      id: "sp-route-alt",
      type: "line",
      source: "sp-routes",
      filter: ["!=", ["get", "id"], selectedRoute || "__none__"],
      paint: {
        "line-color": "#8b9c94",
        "line-width": 4.5,
        "line-opacity": 0.65,
        "line-dasharray": [2, 1.5],
      },
    });
    map.addLayer({
      id: "sp-route-selected-casing",
      type: "line",
      source: "sp-routes",
      filter: ["==", ["get", "id"], selectedRoute || "__none__"],
      paint: { "line-color": "#0d4e48", "line-width": 9, "line-opacity": 0.4 },
    });
    map.addLayer({
      id: "sp-route-selected",
      type: "line",
      source: "sp-routes",
      filter: ["==", ["get", "id"], selectedRoute || "__none__"],
      paint: {
        "line-color": "#16756c",
        "line-width": 6,
        "line-opacity": 0.95,
      },
    });

    // Breadcrumb
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
      paint: { "line-color": "#0284c7", "line-width": 4, "line-opacity": 0.85 },
    });

    // Endpoints
    map.addSource("sp-endpoints", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "sp-endpoints-halo",
      type: "circle",
      source: "sp-endpoints",
      paint: {
        "circle-radius": 13,
        "circle-color": ["get", "color"],
        "circle-opacity": 0.2,
      },
    });
    map.addLayer({
      id: "sp-endpoints-circle",
      type: "circle",
      source: "sp-endpoints",
      paint: {
        "circle-radius": 7,
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2.5,
      },
    });

    // Current location
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

    // Help points
    map.addSource("sp-help", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterRadius: 42,
      clusterMaxZoom: 14,
    });
    map.addLayer({
      id: "sp-help-clusters",
      type: "circle",
      source: "sp-help",
      filter: ["has", "point_count"],
      paint: {
        "circle-radius": [
          "step",
          ["get", "point_count"],
          16,
          10,
          20,
          30,
          25,
        ],
        "circle-color": "#0f766e",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
    map.addLayer({
      id: "sp-help-cluster-count",
      type: "symbol",
      source: "sp-help",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 11,
      },
      paint: { "text-color": "#ffffff" },
    });
    map.addLayer({
      id: "sp-help-points",
      type: "circle",
      source: "sp-help",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 8,
        "circle-color": [
          "match",
          ["get", "category"],
          "police",
          "#1d4ed8",
          "hospital",
          "#dc2626",
          "pharmacy",
          "#15803d",
          "transport",
          "#7c3aed",
          "#0f766e",
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    });

    // Re-attach click handlers
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

    setMapLoaded(true);
  }, [onSelectHelp, onSelectRoute, selectedRoute]);

  // ── Central syncData ─────────────────────────────────────────────────────
  const syncData = useCallback(function syncDataImpl(map: MapLibreMap) {
    if (!map.isStyleLoaded()) {
      // Queue for when style finishes loading
      map.once("styledata", () => syncDataImpl(map));
      return;
    }

    // Ensure sources exist (they may be missing after a style reload)
    if (!map.getSource("sp-routes")) {
      // Re-add all sources and layers after style change
      addSourcesAndLayers(map);
    }

    // Routes
    const routeSource = map.getSource("sp-routes") as GeoJSONSource | undefined;
    routeSource?.setData(collection(routes.map(routeFeature)));

    // Selection filters
    if (map.getLayer("sp-route-selected")) {
      const sel = selectedRoute || "__none__";
      map.setFilter("sp-route-selected", ["==", ["get", "id"], sel]);
      map.setFilter("sp-route-selected-casing", ["==", ["get", "id"], sel]);
      map.setFilter("sp-route-alt", ["!=", ["get", "id"], sel]);
    }

    // Help points
    const helpSource = map.getSource("sp-help") as GeoJSONSource | undefined;
    helpSource?.setData({
      type: "FeatureCollection",
      features: helpPoints.map((x) => ({
        type: "Feature" as const,
        properties: {
          id: x.id,
          category: x.category,
        },
        geometry: { type: "Point" as const, coordinates: x.coordinate },
      })),
    });

    if (map.getLayer("sp-help-points")) {
      map.setPaintProperty("sp-help-points", "circle-radius", [
        "case",
        ["==", ["get", "id"], selectedHelpPoint || ""],
        11,
        8,
      ]);
    }

    // Endpoints (origin / destination)
    const endpSource = map.getSource("sp-endpoints") as
      | GeoJSONSource
      | undefined;
    const endpFeatures: {
      type: "Feature";
      properties: { color: string; role: string };
      geometry: { type: "Point"; coordinates: [number, number] };
    }[] = [];
    if (originPoint) {
      endpFeatures.push({
        type: "Feature",
        properties: { color: "#16756c", role: "origin" },
        geometry: { type: "Point", coordinates: originPoint },
      });
    }
    if (destinationPoint) {
      endpFeatures.push({
        type: "Feature",
        properties: { color: "#b6433d", role: "destination" },
        geometry: { type: "Point", coordinates: destinationPoint },
      });
    }
    endpSource?.setData({ type: "FeatureCollection", features: endpFeatures });

    // Breadcrumb
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

    // Current location
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

    // ── fitBounds — only when data changed, not every render ─────────────
    const activeRoute = routes.find((r) => r.id === selectedRoute);
    if (activeRoute && activeRoute.coordinates.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      activeRoute.coordinates.forEach((coord) => bounds.extend(coord));
      routes
        .filter((r) => r.id !== selectedRoute)
        .forEach((r) => r.coordinates.forEach((c) => bounds.extend(c)));
      if (originPoint) bounds.extend(originPoint);
      if (destinationPoint) bounds.extend(destinationPoint);
      if (currentLocation) bounds.extend(currentLocation);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 55, maxZoom: 16, duration: 900 });
      }
    } else if (originPoint || destinationPoint) {
      const bounds = new maplibregl.LngLatBounds();
      if (originPoint) bounds.extend(originPoint);
      if (destinationPoint) bounds.extend(destinationPoint);
      if (originPoint && destinationPoint) {
        map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 750 });
      } else {
        map.flyTo({
          center: (originPoint || destinationPoint)!,
          zoom: 15,
          duration: 750,
        });
      }
    }

    // Focus selected help point
    const selHelp = helpPoints.find((p) => p.id === selectedHelpPoint);
    if (selHelp) {
      map.flyTo({
        center: selHelp.coordinate,
        zoom: Math.max(map.getZoom(), 15),
        duration: 650,
      });
    }
  }, [addSourcesAndLayers, breadcrumbCoordinates, currentLocation, destinationPoint, helpPoints, originPoint, routes, selectedHelpPoint, selectedRoute]);


  // ── Map initialization (once) ──────────────────────────────────────────────
  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const styleUrl = getMapStyle(theme);

    const map = new maplibregl.Map({
      container: container.current,
      style: styleUrl,
      center: [72.84, 19.05],
      zoom: 11.2,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.on("load", () => {
      // ── 1. Route source + layers ─────────────────────────────────────────
      map.addSource("sp-routes", { type: "geojson", data: collection([]) });

      // Alternative routes — muted dashed
      map.addLayer({
        id: "sp-route-alt",
        type: "line",
        source: "sp-routes",
        filter: ["!=", ["get", "id"], selectedRoute || "__none__"],
        paint: {
          "line-color": "#8b9c94",
          "line-width": 4.5,
          "line-opacity": 0.65,
          "line-dasharray": [2, 1.5],
        },
      });

      // Selected route — prominent teal casing + fill
      map.addLayer({
        id: "sp-route-selected-casing",
        type: "line",
        source: "sp-routes",
        filter: ["==", ["get", "id"], selectedRoute || "__none__"],
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
        filter: ["==", ["get", "id"], selectedRoute || "__none__"],
        paint: {
          "line-color": "#16756c",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });

      // ── 2. Breadcrumb ──────────────────────────────────────────────────────
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

      // ── 3. Origin / Destination endpoints ─────────────────────────────────
      map.addSource("sp-endpoints", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      // Outer halo
      map.addLayer({
        id: "sp-endpoints-halo",
        type: "circle",
        source: "sp-endpoints",
        paint: {
          "circle-radius": 13,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.2,
        },
      });
      // Inner dot
      map.addLayer({
        id: "sp-endpoints-circle",
        type: "circle",
        source: "sp-endpoints",
        paint: {
          "circle-radius": 7,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
        },
      });

      // ── 4. Current GPS location ────────────────────────────────────────────
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

      // ── 5. Help points ─────────────────────────────────────────────────────
      map.addSource("sp-help", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 42,
        clusterMaxZoom: 14,
      });
      map.addLayer({
        id: "sp-help-clusters",
        type: "circle",
        source: "sp-help",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16,
            10,
            20,
            30,
            25,
          ],
          "circle-color": "#0f766e",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "sp-help-cluster-count",
        type: "symbol",
        source: "sp-help",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 11,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "sp-help-points",
        type: "circle",
        source: "sp-help",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "id"], selectedHelpPoint || ""],
            11,
            8,
          ],
          "circle-color": [
            "match",
            ["get", "category"],
            "police",
            "#1d4ed8",
            "hospital",
            "#dc2626",
            "pharmacy",
            "#15803d",
            "transport",
            "#7c3aed",
            "#0f766e",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
        },
      });

      map.resize();
      setMapLoaded(true);

      // ── Interaction handlers ──────────────────────────────────────────────
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
      map.on("click", "sp-help-clusters", (e) => {
        const feature = e.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        const source = map.getSource("sp-help") as GeoJSONSource;
        if (clusterId !== undefined && feature?.geometry.type === "Point") {
          void source.getClusterExpansionZoom(clusterId).then((zoom) =>
            map.easeTo({
              center: feature.geometry.coordinates as [number, number],
              zoom,
            }),
          );
          void source
            .getClusterExpansionZoom(clusterId)
            .then((zoom) =>
              map.easeTo({
                center: feature.geometry.coordinates as [number, number],
                zoom,
              }),
            );
        }
      });

      // Cursor feedback
      for (const layer of [
        "sp-route-alt",
        "sp-route-selected",
        "sp-help-points",
        "sp-help-clusters",
      ]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // Apply any data that arrived before map was ready
      if (pendingSync.current) {
        pendingSync.current = false;
        syncData(map);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // ── Theme change — update map style ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const styleUrl = getMapStyle(theme);
    map.setStyle(styleUrl);
    // After style reload, re-add all sources/layers
    map.once("styledata", () => {
      setMapLoaded(false); // triggers re-init of sources after style loads
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // ── Central syncData ─────────────────────────────────────────────────────
  const syncDataLegacy = (map: MapLibreMap) => {
    if (!map.isStyleLoaded()) {
      // Queue for when style finishes loading
      map.once("styledata", () => syncDataLegacy(map));
      return;
    }

    // Ensure sources exist (they may be missing after a style reload)
    if (!map.getSource("sp-routes")) {
      // Re-add all sources and layers after style change
      addSourcesAndLayersLegacy(map);
    }

    // Routes
    const routeSource = map.getSource("sp-routes") as GeoJSONSource | undefined;
    routeSource?.setData(collection(routes.map(routeFeature)));

    // Selection filters
    if (map.getLayer("sp-route-selected")) {
      const sel = selectedRoute || "__none__";
      map.setFilter("sp-route-selected", ["==", ["get", "id"], sel]);
      map.setFilter("sp-route-selected-casing", ["==", ["get", "id"], sel]);
      map.setFilter("sp-route-alt", ["!=", ["get", "id"], sel]);
    }

    // Help points
    const helpSource = map.getSource("sp-help") as GeoJSONSource | undefined;
    helpSource?.setData({
      type: "FeatureCollection",
      features: helpPoints.map((x) => ({
        type: "Feature" as const,
        properties: {
          id: x.id,
          category: x.category,
        },
        geometry: { type: "Point" as const, coordinates: x.coordinate },
      })),
    });

    if (map.getLayer("sp-help-points")) {
      map.setPaintProperty("sp-help-points", "circle-radius", [
        "case",
        ["==", ["get", "id"], selectedHelpPoint || ""],
        11,
        8,
      ]);
    }

    // Endpoints (origin / destination)
    const endpSource = map.getSource("sp-endpoints") as
      | GeoJSONSource
      | undefined;
    const endpFeatures: {
      type: "Feature";
      properties: { color: string; role: string };
      geometry: { type: "Point"; coordinates: [number, number] };
    }[] = [];
    if (originPoint) {
      endpFeatures.push({
        type: "Feature",
        properties: { color: "#16756c", role: "origin" },
        geometry: { type: "Point", coordinates: originPoint },
      });
    }
    if (destinationPoint) {
      endpFeatures.push({
        type: "Feature",
        properties: { color: "#b6433d", role: "destination" },
        geometry: { type: "Point", coordinates: destinationPoint },
      });
    }
    endpSource?.setData({ type: "FeatureCollection", features: endpFeatures });

    // Breadcrumb
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

    // Current location
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

    // ── fitBounds — only when data changed, not every render ─────────────
    const activeRoute = routes.find((r) => r.id === selectedRoute);
    if (activeRoute && activeRoute.coordinates.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      activeRoute.coordinates.forEach((coord) => bounds.extend(coord));
      routes
        .filter((r) => r.id !== selectedRoute)
        .forEach((r) => r.coordinates.forEach((c) => bounds.extend(c)));
      if (originPoint) bounds.extend(originPoint);
      if (destinationPoint) bounds.extend(destinationPoint);
      if (currentLocation) bounds.extend(currentLocation);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 55, maxZoom: 16, duration: 900 });
      }
    } else if (currentLocation) {
      map.flyTo({ center: currentLocation, zoom: 15, duration: 750 });
    } else if (originPoint || destinationPoint) {
      const bounds = new maplibregl.LngLatBounds();
      if (originPoint) bounds.extend(originPoint);
      if (destinationPoint) bounds.extend(destinationPoint);
      if (originPoint && destinationPoint) {
        map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 750 });
      } else {
        map.flyTo({
          center: (originPoint || destinationPoint)!,
          zoom: 15,
          duration: 750,
        });
      }
    }

    // Focus selected help point
    const selHelp = helpPoints.find((p) => p.id === selectedHelpPoint);
    if (selHelp) {
      map.flyTo({
        center: selHelp.coordinate,
        zoom: Math.max(map.getZoom(), 15),
        duration: 650,
      });
    }
  };

  // Helper: add all sources + layers (after style reload)
  const addSourcesAndLayersLegacy = (map: MapLibreMap) => {
    // Routes
    map.addSource("sp-routes", { type: "geojson", data: collection([]) });
    map.addLayer({
      id: "sp-route-alt",
      type: "line",
      source: "sp-routes",
      filter: ["!=", ["get", "id"], selectedRoute || "__none__"],
      paint: {
        "line-color": "#8b9c94",
        "line-width": 4.5,
        "line-opacity": 0.65,
        "line-dasharray": [2, 1.5],
      },
    });
    map.addLayer({
      id: "sp-route-selected-casing",
      type: "line",
      source: "sp-routes",
      filter: ["==", ["get", "id"], selectedRoute || "__none__"],
      paint: { "line-color": "#0d4e48", "line-width": 9, "line-opacity": 0.4 },
    });
    map.addLayer({
      id: "sp-route-selected",
      type: "line",
      source: "sp-routes",
      filter: ["==", ["get", "id"], selectedRoute || "__none__"],
      paint: {
        "line-color": "#16756c",
        "line-width": 6,
        "line-opacity": 0.95,
      },
    });

    // Breadcrumb
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
      paint: { "line-color": "#0284c7", "line-width": 4, "line-opacity": 0.85 },
    });

    // Endpoints
    map.addSource("sp-endpoints", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "sp-endpoints-halo",
      type: "circle",
      source: "sp-endpoints",
      paint: {
        "circle-radius": 13,
        "circle-color": ["get", "color"],
        "circle-opacity": 0.2,
      },
    });
    map.addLayer({
      id: "sp-endpoints-circle",
      type: "circle",
      source: "sp-endpoints",
      paint: {
        "circle-radius": 7,
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2.5,
      },
    });

    // Current location
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

    // Help points
    map.addSource("sp-help", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterRadius: 42,
      clusterMaxZoom: 14,
    });
    map.addLayer({
      id: "sp-help-clusters",
      type: "circle",
      source: "sp-help",
      filter: ["has", "point_count"],
      paint: {
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 30, 25],
        "circle-color": "#0f766e",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
    map.addLayer({
      id: "sp-help-cluster-count",
      type: "symbol",
      source: "sp-help",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 11,
      },
      paint: { "text-color": "#ffffff" },
    });
    map.addLayer({
      id: "sp-help-points",
      type: "circle",
      source: "sp-help",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 8,
        "circle-color": [
          "match",
          ["get", "category"],
          "police",
          "#1d4ed8",
          "hospital",
          "#dc2626",
          "pharmacy",
          "#15803d",
          "transport",
          "#7c3aed",
          "#0f766e",
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    });

    // Re-attach click handlers
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

    setMapLoaded(true);
  };

  // ── Sync data whenever props change ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!mapLoaded) {
      // Mark pending — will be applied once map/style loads
      pendingSync.current = true;
      return;
    }

    syncDataLegacy(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    routes,
    helpPoints,
    selectedRoute,
    breadcrumbCoordinates,
    currentLocation,
    originPoint,
    destinationPoint,
    selectedHelpPoint,
    mapLoaded,
    syncDataLegacy,
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
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded border border-[#d8ddd7] bg-[#fffefb]/95 p-2.5 text-[11px] shadow-sm backdrop-blur-xs dark:bg-[#1a2321]/95 dark:border-[#2d3d36] dark:text-[#c4d0ca]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-full bg-[#16756c]" />
          <span className="font-medium text-[#14231d] dark:text-[#d8e4de]">
            Selected corridor
          </span>
          <span className="font-medium text-[#14231d] dark:text-[#d8e4de]">Selected corridor</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-[#8b9c94]" />
          <span className="text-[#53615a] dark:text-[#7a8f84]">
            Alternative paths
          </span>
          <span className="text-[#53615a] dark:text-[#7a8f84]">Alternative paths</span>
        </div>
        {originPoint && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#16756c]" />
            <span className="text-[#53615a] dark:text-[#7a8f84]">Origin</span>
          </div>
        )}
        {destinationPoint && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#b6433d]" />
            <span className="text-[#53615a] dark:text-[#7a8f84]">
              Destination
            </span>
            <span className="text-[#53615a] dark:text-[#7a8f84]">Destination</span>
          </div>
        )}
        {breadcrumbCoordinates.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-4 rounded-full bg-[#0284c7]" />
            <span className="text-[#0284c7]">Traveled path</span>
          </div>
        )}
        {helpPoints.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#16756c] bg-[#fffefb] dark:bg-[#1a2321]" />
            <span className="text-[#53615a] dark:text-[#7a8f84]">
              Help facilities
            </span>
            <span className="text-[#53615a] dark:text-[#7a8f84]">Help facilities</span>
          </div>
        )}
      </div>

      {/* Map Controls */}
      <div className="absolute right-3 top-3 flex flex-col border border-[#d8ddd7] bg-[#fffefb] shadow-sm dark:bg-[#1c2b24] dark:border-[#2d3d36]">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="h-9 w-9 text-lg font-bold text-[#14231d] hover:bg-[#f0f2ed] dark:text-[#c4d0ca] dark:hover:bg-[#243329]"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="h-9 w-9 border-t border-[#d8ddd7] text-lg font-bold text-[#14231d] hover:bg-[#f0f2ed] dark:text-[#c4d0ca] dark:hover:bg-[#243329] dark:border-[#2d3d36]"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => {
            const map = mapRef.current;
            if (!map) return;
            if (currentLocation) {
              map.flyTo({ center: currentLocation, zoom: 15 });
              return;
            }
            const activeRoute = routes.find(
              (route) => route.id === selectedRoute,
            );
            if (activeRoute && activeRoute.coordinates.length > 1) {
              const bounds = new maplibregl.LngLatBounds();
              activeRoute.coordinates.forEach((c) => bounds.extend(c));
              map.fitBounds(bounds, {
                padding: 45,
                maxZoom: 15,
                duration: 750,
              });
              map.fitBounds(bounds, { padding: 45, maxZoom: 15, duration: 750 });
              return;
            }
            if (originPoint && destinationPoint) {
              map.fitBounds(
                new maplibregl.LngLatBounds(originPoint, destinationPoint),
                { padding: 80, maxZoom: 14, duration: 750 },
              );
              return;
            }
            map.flyTo({
              center: originPoint || destinationPoint || [72.84, 19.05],
              zoom: originPoint || destinationPoint ? 15 : 11.2,
              duration: 750,
            });
          }}
          className="h-9 w-9 border-t border-[#d8ddd7] text-xs font-semibold text-[#16756c] hover:bg-[#f0f2ed] dark:border-[#2d3d36] dark:hover:bg-[#243329]"
          aria-label="Recenter map"
        >
          ◎
        </button>
      </div>
    </div>
  );
}
