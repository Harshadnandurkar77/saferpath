/**
 * Context Translation Layer
 * 
 * Translates technical backend enums, flags, and metadata into clear,
 * calm civilian prose. Never exposes raw database constants, enums,
 * or numeric safety scores.
 */

export interface ContextDisplay {
  label: string;
  summary: string;
  badgeClass: string;
  dotColor: string;
  tone: "supportive" | "mixed" | "caution" | "limited";
}

export function formatContextBand(band?: string): ContextDisplay {
  switch (band?.toUpperCase()) {
    case "STRONG_CONTEXTUAL_SUPPORT":
      return {
        label: "Well-supported context",
        summary: "Continuous lighting, commercial activity, and nearby help points verified along this path.",
        badgeClass: "bg-[#dcefe9] text-[#075b53] border-[#16756c]",
        dotColor: "#16756c",
        tone: "supportive",
      };
    case "GOOD_CONTEXT":
      return {
        label: "Good contextual clarity",
        summary: "Frequent street lighting and active footpaths with clear visibility.",
        badgeClass: "bg-[#dcefe9] text-[#075b53] border-[#16756c]",
        dotColor: "#16756c",
        tone: "supportive",
      };
    case "MIXED_CONTEXT":
      return {
        label: "Mixed conditions",
        summary: "Some well-lit corridors transition into quieter or less active stretches.",
        badgeClass: "bg-[#fcf3d9] text-[#9a6400] border-[#d49e24]",
        dotColor: "#d49e24",
        tone: "mixed",
      };
    case "CAUTION_SEGMENT":
      return {
        label: "Reduced visibility segment",
        summary: "Sections with intermittent lighting or limited evening foot traffic.",
        badgeClass: "bg-[#fde8e7] text-[#b6433d] border-[#b6433d]",
        dotColor: "#b6433d",
        tone: "caution",
      };
    case "LIMITED_DATA":
      return {
        label: "Limited civic data",
        summary: "Fewer recorded street-level observations along parts of this path.",
        badgeClass: "bg-[#f0f2ed] text-[#53615a] border-[#bdc9c0]",
        dotColor: "#65746d",
        tone: "limited",
      };
    case "UNKNOWN":
    default:
      return {
        label: "Context being mapped",
        summary: "Corridor conditions are being actively updated from local observations.",
        badgeClass: "bg-[#f0f2ed] text-[#53615a] border-[#bdc9c0]",
        dotColor: "#65746d",
        tone: "limited",
      };
  }
}

/**
 * Translates signal/flag names into human-readable civilian labels
 */
export function translateSignal(signal: string): { label: string; explanation: string; icon: "light" | "people" | "transit" | "store" | "caution" | "info" } {
  const norm = signal.toUpperCase().replace(/\s+/g, "_");
  
  if (norm.includes("LIGHT") && (norm.includes("HIGH") || norm.includes("STRONG") || norm.includes("CONTINUOUS") || norm.includes("GOOD"))) {
    return {
      label: "Continuous street lighting",
      explanation: "Street lamps mapped and active along this corridor.",
      icon: "light",
    };
  }
  if (norm.includes("LOW_LIGHT") || norm.includes("POOR_LIGHT") || norm.includes("INTERMITTENT_LIGHT")) {
    return {
      label: "Intermittent lighting",
      explanation: "Stretches between fixtures may be dimmer after dark.",
      icon: "caution",
    };
  }
  if (norm.includes("PEDESTRIAN") || norm.includes("FOOT_TRAFFIC") || norm.includes("ACTIVE_WALK")) {
    return {
      label: "Regular foot traffic",
      explanation: "Frequent pedestrian presence observed during evening hours.",
      icon: "people",
    };
  }
  if (norm.includes("COMMERCIAL") || norm.includes("STORE") || norm.includes("SHOP") || norm.includes("FRONTAGE")) {
    return {
      label: "Active shopfronts & businesses",
      explanation: "Open businesses provide natural sightlines and informal observation.",
      icon: "store",
    };
  }
  if (norm.includes("TRANSIT") || norm.includes("STATION") || norm.includes("BUS_STOP") || norm.includes("METRO")) {
    return {
      label: "Transit hub proximity",
      explanation: "Near transit stops with passenger activity and staffed booths.",
      icon: "transit",
    };
  }
  if (norm.includes("ISOLATED") || norm.includes("QUIET") || norm.includes("LOW_ACTIVITY")) {
    return {
      label: "Quieter residential stretch",
      explanation: "Lower pedestrian volume, particularly later in the night.",
      icon: "caution",
    };
  }
  if (norm.includes("HELP") || norm.includes("POLICE") || norm.includes("PHARMACY")) {
    return {
      label: "Assistance nearby",
      explanation: "Verified public facility or open pharmacy within 250 meters.",
      icon: "info",
    };
  }
  if (norm.includes("DAYLIGHT")) {
    return {
      label: "Daylight visibility",
      explanation: "Natural ambient light expected during planned travel time.",
      icon: "light",
    };
  }
  if (norm.includes("NIGHT") || norm.includes("AFTER_DARK")) {
    return {
      label: "Travel after dark",
      explanation: "Planned during night hours; lighting context is especially relevant.",
      icon: "light",
    };
  }

  // Fallback: convert SNAKE_CASE to Title Case
  const words = norm.replace(/_/g, " ").toLowerCase().split(" ");
  const capitalized = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return {
    label: capitalized,
    explanation: "Observed municipal feature along this segment.",
    icon: "info",
  };
}

/**
 * Format timestamps into human-readable local time
 */
export function formatLocalTimeDisplay(isoString?: string): string {
  if (!isoString) {
    const now = new Date();
    return `Leaving now · ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return isoString;
  }
}

/**
 * Translate freshness indicators into friendly phrasing
 */
export function formatFreshness(updatedAt?: string): string {
  if (!updatedAt) return "Continuously updated";
  try {
    const diffHours = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60);
    if (diffHours < 2) return "Updated in the last hour";
    if (diffHours < 24) return `Updated ${Math.round(diffHours)} hours ago`;
    if (diffHours < 48) return "Updated yesterday";
    return `Recorded ${new Date(updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}`;
  } catch {
    return "Recently verified";
  }
}

