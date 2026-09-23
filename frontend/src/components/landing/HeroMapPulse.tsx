import { useEffect, useState } from "react";
import { Crosshair, Navigation, Radio } from "lucide-react";
import { SaferPathMap } from "../map/SaferPathMap";
import type { MapHelpPoint, MapRoute } from "../map/mapTypes";

const routes: MapRoute[] = [
  { id: "hill-road", label: "Hill Road corridor", context: "good", coordinates: [[72.8264, 19.055], [72.8285, 19.0557], [72.831, 19.0572], [72.8346, 19.058]] },
  { id: "link-road", label: "Link Road alternative", context: "mixed", coordinates: [[72.8264, 19.055], [72.829, 19.0536], [72.8328, 19.0556], [72.8346, 19.058]] },
];

const helpPoints: MapHelpPoint[] = [
  { id: "pharmacy", name: "24-hour pharmacy", category: "pharmacy", coordinate: [72.831, 19.0572], freshness: "Verified today" },
  { id: "transit", name: "Transit help desk", category: "transport", coordinate: [72.8346, 19.058], freshness: "Verified today" },
];

const signals = ["lighting continuity", "active frontage", "help nearby", "footpath visibility"];

export function HeroMapPulse() {
  const [signal, setSignal] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setSignal((current) => (current + 1) % signals.length), 2400);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="hero-map-pulse" aria-label="Live map preview of a route through Bandra West">
      <SaferPathMap
        className="hero-map-pulse__map"
        routes={routes}
        selectedRoute="hill-road"
        helpPoints={helpPoints}
        originPoint={[72.8264, 19.055]}
        destinationPoint={[72.8346, 19.058]}
        currentLocation={[72.8301, 19.0567]}
      />
      <div className="hero-map-pulse__wash" aria-hidden="true" />
      <div className="hero-map-pulse__orbit" aria-hidden="true">
        <span>ROUTE INTELLIGENCE • ROUTE INTELLIGENCE • </span>
      </div>
      <div className="hero-map-pulse__top">
        <span><Radio className="h-3 w-3" /> LIVE CORRIDOR</span>
        <span>BANDRA W · 1.4 KM</span>
      </div>
      <div className="hero-map-pulse__signal">
        <Crosshair className="h-4 w-4" />
        <span>Scanning <strong key={signals[signal]}>{signals[signal]}</strong></span>
      </div>
      <div className="hero-map-pulse__eta"><Navigation className="h-3.5 w-3.5 fill-current" /> 18 min walk</div>
      <div className="hero-map-pulse__legend">
        <span><i className="hero-map-pulse__legend-line hero-map-pulse__legend-line--selected" />Selected route</span>
        <span><i className="hero-map-pulse__legend-line" />Alternative route</span>
      </div>
    </div>
  );
}
