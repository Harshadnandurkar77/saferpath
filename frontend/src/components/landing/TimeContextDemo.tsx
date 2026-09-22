import { useState, useEffect } from "react";
import { Sun, Sunset, Moon, Play, Pause, ShieldCheck, Eye, Store, HelpCircle } from "lucide-react";

interface TimeState {
  timeLabel: string;
  hour: number;
  period: "day" | "dusk" | "night";
  title: string;
  description: string;
  lightingLabel: string;
  lightingTone: string;
  footTrafficLabel: string;
  footTrafficTone: string;
  servicesLabel: string;
  activeContextBadges: { text: string; tone: "good" | "mixed" | "neutral" }[];
  skyGradient: string;
}

const TIME_STEPS: TimeState[] = [
  {
    timeLabel: "8:30 AM",
    hour: 8.5,
    period: "day",
    title: "Morning Commute",
    description: "High natural daylight and dense pedestrian traffic around schools and transit hubs.",
    lightingLabel: "Full natural daylight",
    lightingTone: "text-[#075b53]",
    footTrafficLabel: "High continuous foot traffic",
    footTrafficTone: "text-[#075b53]",
    servicesLabel: "All civic amenities and commercial frontages open",
    activeContextBadges: [
      { text: "Full Daylight", tone: "good" },
      { text: "Active Commuter Corridors", tone: "good" },
      { text: "Staffed Transit Gates", tone: "good" },
    ],
    skyGradient: "from-sky-100 via-amber-50 to-white",
  },
  {
    timeLabel: "6:45 PM",
    hour: 18.75,
    period: "dusk",
    title: "Evening Transition",
    description: "Dusk lighting transition with full street lamps illuminated and active storefronts.",
    lightingLabel: "Continuous municipal street lamps active",
    lightingTone: "text-[#075b53]",
    footTrafficLabel: "Busy market & dining footpaths",
    footTrafficTone: "text-[#075b53]",
    servicesLabel: "Evening retail and transit kiosks operating",
    activeContextBadges: [
      { text: "Active Street Lighting", tone: "good" },
      { text: "Commercial Frontage Sightlines", tone: "good" },
      { text: "Transit Security Booths Active", tone: "good" },
    ],
    skyGradient: "from-amber-100 via-orange-50 to-stone-50",
  },
  {
    timeLabel: "11:15 PM",
    hour: 23.25,
    period: "night",
    title: "Nighttime Corridor",
    description: "Retail shutters down; route context shifts to main arterial lighting and 24/7 help points.",
    lightingLabel: "Main road lighting on; side lanes dimmer",
    lightingTone: "text-[#9a6400]",
    footTrafficLabel: "Lower pedestrian volume; vehicular arterials active",
    footTrafficTone: "text-[#9a6400]",
    servicesLabel: "24-hour pharmacy and emergency police booth within 180m",
    activeContextBadges: [
      { text: "Arterial Road Illumination", tone: "mixed" },
      { text: "Quieter Side Alleys", tone: "mixed" },
      { text: "24/7 Help Facility Verified", tone: "good" },
    ],
    skyGradient: "from-slate-900 via-slate-800 to-[#14231d]",
  },
];

export function TimeContextDemo() {
  const [activeIndex, setActiveIndex] = useState(1); // Default to dusk (6:45 PM)
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % TIME_STEPS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const current = TIME_STEPS[activeIndex];

  return (
    <div className="rounded-2xl border border-[#d8ddd7] bg-[#fffefb] p-6 shadow-sm sm:p-8">
      {/* Header with Play/Pause controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e2e6e1] pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#16756c]">
            Interactive Demonstration
          </span>
          <h3 className="mt-1 font-serif text-2xl font-semibold text-[#14231d]">
            The same street has different context at different hours.
          </h3>
          <p className="mt-1 text-sm text-[#53615a]">
            Lighting, open storefronts, transit activity, and pedestrian density naturally change over a 24-hour cycle.
          </p>
        </div>

        {/* Time Selector Buttons */}
        <div className="flex items-center gap-1.5 rounded-lg border border-[#bdc9c0] bg-[#f7f6f1] p-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#bdc9c0] bg-white text-[#14231d] hover:bg-[#f0f2ed]"
            title={isPlaying ? "Pause auto-demonstration" : "Resume auto-demonstration"}
            aria-label={isPlaying ? "Pause auto-demonstration" : "Resume auto-demonstration"}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
          </button>
          {TIME_STEPS.map((step, idx) => (
            <button
              key={step.timeLabel}
              onClick={() => {
                setActiveIndex(idx);
                setIsPlaying(false);
              }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeIndex === idx
                  ? "bg-[#16756c] text-white shadow-xs"
                  : "text-[#53615a] hover:bg-[#e8ece7] hover:text-[#14231d]"
              }`}
            >
              {idx === 0 && <Sun className="h-3.5 w-3.5" />}
              {idx === 1 && <Sunset className="h-3.5 w-3.5" />}
              {idx === 2 && <Moon className="h-3.5 w-3.5" />}
              {step.timeLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Main visual comparison panel */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* Left: Corridor visual card shifting with atmosphere */}
        <div
          className={`relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#d8ddd7] bg-gradient-to-b ${current.skyGradient} p-6 transition-all duration-700 lg:col-span-5`}
        >
          {/* Corridor Tag */}
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                current.period === "night"
                  ? "bg-slate-800/90 text-amber-200 border border-slate-700"
                  : "bg-white/90 text-[#14231d] border border-[#d8ddd7]"
              }`}
            >
              {current.period === "day" && <Sun className="h-3 w-3 text-amber-500" />}
              {current.period === "dusk" && <Sunset className="h-3 w-3 text-orange-500" />}
              {current.period === "night" && <Moon className="h-3 w-3 text-amber-300" />}
              {current.timeLabel} · {current.title}
            </span>
            <span
              className={`text-xs font-mono font-medium ${
                current.period === "night" ? "text-slate-300" : "text-[#53615a]"
              }`}
            >
              Corridor 12B
            </span>
          </div>

          {/* Graphic street representation */}
          <div className="my-8 flex flex-col items-center">
            <div className="relative w-full max-w-[280px]">
              {/* Route line */}
              <div
                className={`h-2.5 w-full rounded-full transition-colors duration-700 ${
                  current.period === "night" ? "bg-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.5)]" : "bg-[#16756c]"
                }`}
              />
              {/* Nodes */}
              <div className="mt-2 flex justify-between text-[10px] font-semibold">
                <span className={current.period === "night" ? "text-slate-300" : "text-[#53615a]"}>Station Rd</span>
                <span className={current.period === "night" ? "text-slate-300" : "text-[#53615a]"}>Market Link</span>
                <span className={current.period === "night" ? "text-slate-300" : "text-[#53615a]"}>Hill Junction</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <p
            className={`text-xs leading-relaxed transition-colors duration-700 ${
              current.period === "night" ? "text-slate-200" : "text-[#53615a]"
            }`}
          >
            {current.description}
          </p>
        </div>

        {/* Right: Context breakdown */}
        <div className="flex flex-col justify-between rounded-xl border border-[#d8ddd7] bg-[#f7f6f1] p-6 lg:col-span-7">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-serif text-lg font-semibold text-[#14231d]">
                Contextual Observations for {current.timeLabel}
              </h4>
              <span className="rounded-sm bg-[#dcefe9] px-2 py-0.5 text-[11px] font-semibold text-[#075b53]">
                Calibrated Local Time
              </span>
            </div>

            {/* Signal rows */}
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-[#e2e6e1] bg-white p-3">
                <Eye className="mt-0.5 h-4 w-4 text-[#16756c] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[#14231d]">Street Illumination & Sightlines</p>
                  <p className={`mt-0.5 text-xs font-medium ${current.lightingTone}`}>
                    {current.lightingLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-[#e2e6e1] bg-white p-3">
                <Store className="mt-0.5 h-4 w-4 text-[#16756c] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[#14231d]">Footpath Activity & Commercial Presence</p>
                  <p className={`mt-0.5 text-xs font-medium ${current.footTrafficTone}`}>
                    {current.footTrafficLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-[#e2e6e1] bg-white p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-[#16756c] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[#14231d]">Civic Amenities & Emergency Proximity</p>
                  <p className="mt-0.5 text-xs font-medium text-[#53615a]">
                    {current.servicesLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contextual signals chips */}
          <div className="mt-4 border-t border-[#d8ddd7] pt-3">
            <div className="flex items-center gap-1 text-[11px] text-[#53615a]">
              <HelpCircle className="h-3.5 w-3.5 text-[#16756c]" />
              <span>Evidence points mapped at this hour:</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {current.activeContextBadges.map((b) => (
                <span
                  key={b.text}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    b.tone === "good"
                      ? "border-[#16756c] bg-[#dcefe9] text-[#075b53]"
                      : "border-[#d49e24] bg-[#fcf3d9] text-[#9a6400]"
                  }`}
                >
                  {b.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

