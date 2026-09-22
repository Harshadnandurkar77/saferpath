import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Lightbulb,
  Users,
  CheckCircle2,
  Navigation,
  LifeBuoy,
  MapPin,
  Moon,
  Sun,
  AlertTriangle,
  Store,
} from "lucide-react";

type TimeOption = "6:00 PM" | "11:30 PM";

export default function Hero() {
  const [selectedTime, setSelectedTime] = useState<TimeOption>("6:00 PM");

  return (
    <section
      id="home"
      className="relative overflow-hidden bg-gradient-to-b from-[#f8faf9] via-[#f2f7f4] to-white pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-24 xl:pt-40 xl:pb-28"
    >
      {/* =====================================================
          BACKGROUND ATMOSPHERE
      ===================================================== */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* Soft emerald atmospheric glow */}
        <div className="absolute -left-32 top-16 h-[500px] w-[500px] rounded-full bg-emerald-100/40 blur-[130px]" />

        {/* Soft cool slate/blue atmospheric glow */}
        <div className="absolute -right-24 top-0 h-[520px] w-[520px] rounded-full bg-blue-100/35 blur-[140px]" />

        {/* Ultra-delicate grid lines */}
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      {/* =====================================================
          MAIN CONTAINER: TWO-COLUMN EDITORIAL HERO
      ===================================================== */}
      <div className="relative mx-auto max-w-[1520px] px-5 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8 xl:gap-14">
          {/* =================================================
              LEFT COLUMN — CONTENT & CTA
          ================================================= */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-start lg:col-span-5 xl:col-span-5"
          >
            {/* 1. Eyebrow */}
            <div className="mb-6 flex items-center gap-3 sm:mb-7">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600 sm:text-xs">
                Context-aware route planning
              </span>
            </div>

            {/* 2. Heading */}
            <h1 className="text-[clamp(2.6rem,4.8vw,4.85rem)] font-bold leading-[1.03] tracking-[-0.048em] text-[#07111F]">
              The fastest route is not always the{" "}
              <span className="relative inline-block text-slate-950">
                best-supported route.
                <span
                  className="absolute -bottom-1 left-0 right-0 h-[3.5px] rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 opacity-90"
                  aria-hidden="true"
                />
              </span>
            </h1>

            {/* 3. Subtitle */}
            <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-600 sm:mt-7 sm:text-lg sm:leading-8 lg:text-xl">
              See how your route changes with time.
            </p>

            {/* 4. Primary CTA */}
            <div className="mt-8 sm:mt-10">
              <motion.a
                href="#how-it-works"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group inline-flex items-center gap-3.5 rounded-full bg-[#07111F] px-7 py-4 text-sm font-semibold text-white shadow-[0_16px_36px_-12px_rgba(7,17,31,0.5)] transition-all duration-200 hover:bg-slate-800 hover:shadow-[0_20px_42px_-12px_rgba(7,17,31,0.65)]"
              >
                <span>See how it works</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 group-hover:translate-x-0.5">
                  <ArrowRight size={14} strokeWidth={2.2} />
                </span>
              </motion.a>
            </div>

            {/* Supporting context line */}
            <div className="mt-9 flex items-center gap-3 border-t border-slate-200/80 pt-5 sm:mt-10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-slate-500">
                More context for the journey ahead.
              </span>
            </div>
          </motion.div>

          {/* =================================================
              RIGHT COLUMN — TIME-AWARE CONTEXT MAP
          ================================================= */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.85,
              delay: 0.1,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="w-full lg:col-span-7 xl:col-span-7"
          >
            <SingleRouteTimeContextMap
              selectedTime={selectedTime}
              setSelectedTime={setSelectedTime}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   SINGLE-ROUTE TIME CONTEXT MAP COMPONENT
   "SAME ROUTE. DIFFERENT TIME. DIFFERENT CONTEXT."
========================================================= */

interface MapProps {
  selectedTime: TimeOption;
  setSelectedTime: (time: TimeOption) => void;
}

function SingleRouteTimeContextMap({ selectedTime, setSelectedTime }: MapProps) {
  const isLate = selectedTime === "11:30 PM";

  // ONE Single Continuous Route Geometry:
  // Connects Start (140, 395) to Destination (680, 150)
  const singleRoutePath =
    "M 140 395 L 260 395 C 310 395, 335 350, 370 310 C 410 265, 450 220, 510 190 L 550 190 C 590 190, 630 170, 650 150 L 680 150";

  return (
    <div className="relative mx-auto w-full max-w-[840px]">
      {/* Soft ambient aura behind container */}
      <div
        className="absolute -inset-4 -z-10 rounded-[40px] bg-gradient-to-r from-emerald-100/50 via-teal-50/40 to-blue-100/40 blur-2xl lg:-inset-6"
        aria-hidden="true"
      />

      {/* Main Map Application Window */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_25px_70px_-20px_rgba(15,23,42,0.18)] sm:rounded-3xl">
        {/* -------------------------------------------------
            TOP BAR: Application Header & Interactive Time Selector
        ------------------------------------------------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-6 sm:py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#07111F] text-white shadow-xs">
              <Navigation size={14} className="rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-tight text-slate-900 sm:text-sm">
                  Route Context Engine
                </span>
                <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[9px] font-semibold text-slate-600 sm:text-[10px]">
                  Same Route
                </span>
              </div>
              <p className="text-[10px] text-slate-400 sm:text-[11px]">
                Central Station → North Residence
              </p>
            </div>
          </div>

          {/* Time Selector Controls */}
          <div className="flex items-center rounded-full border border-slate-200/90 bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setSelectedTime("6:00 PM")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold transition-all sm:px-3.5 sm:py-1.5 sm:text-xs ${
                !isLate
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Sun size={12} />
              <span>6:00 PM</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTime("11:30 PM")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold transition-all sm:px-3.5 sm:py-1.5 sm:text-xs ${
                isLate
                  ? "bg-[#07111F] text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Moon size={12} />
              <span>11:30 PM</span>
            </button>
          </div>
        </div>

        {/* -------------------------------------------------
            MAP CANVAS (SVG CARTOGRAPHY WITH TIME-AWARE CONTEXT)
        ------------------------------------------------- */}
        <div
          className={`relative aspect-[16/11] w-full overflow-hidden transition-colors duration-700 sm:aspect-[16/10] lg:aspect-[1.58/1] ${
            isLate ? "bg-[#e5ece8]" : "bg-[#ecf3ee]"
          }`}
        >
          {/* Base Cartographic SVG */}
          <svg
            viewBox="0 0 820 540"
            className="absolute inset-0 h-full w-full select-none"
            fill="none"
            aria-label="City map showing single continuous route under changing time context"
          >
            <defs>
              {/* 6:00 PM Active Route Gradient */}
              <linearGradient id="routeDayGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="50%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>

              {/* 11:30 PM Night Context Gradient (Shows illuminated vs quiet segments) */}
              <linearGradient id="routeNightGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="42%" stopColor="#F59E0B" />
                <stop offset="70%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>

              {/* Glowing Route Filters */}
              <filter id="dayGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="nightGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="7" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* =================================================
                CITY GEOGRAPHY & BLOCKS
            ================================================= */}
            {/* Waterway in northeast */}
            <path
              d="M 580 0 C 620 60, 690 90, 820 100 L 820 0 Z"
              fill={isLate ? "#d1e0e8" : "#d9e9f2"}
              className="transition-colors duration-700"
            />
            <path
              d="M 640 0 C 670 40, 720 70, 820 78"
              stroke={isLate ? "#bcd2dc" : "#c5dce8"}
              strokeWidth="2"
            />

            {/* Central Green Park */}
            <rect
              x="270"
              y="255"
              width="175"
              height="115"
              rx="22"
              fill={isLate ? "#ccdecb" : "#d6edd8"}
              className="transition-colors duration-700"
            />
            <circle
              cx="310"
              cy="290"
              r="14"
              fill={isLate ? "#b8cdb7" : "#c3e4c6"}
            />
            <circle
              cx="390"
              cy="330"
              r="16"
              fill={isLate ? "#b8cdb7" : "#c3e4c6"}
            />
            <circle
              cx="345"
              cy="335"
              r="11"
              fill={isLate ? "#b8cdb7" : "#c3e4c6"}
            />

            {/* Riverside Greenery */}
            <rect
              x="620"
              y="30"
              width="110"
              height="60"
              rx="16"
              fill={isLate ? "#d0e4d7" : "#d9eee0"}
            />

            {/* South Civic Square */}
            <rect
              x="60"
              y="360"
              width="90"
              height="80"
              rx="18"
              fill={isLate ? "#d0e4d7" : "#d9eee0"}
            />

            {/* Urban Architectural Blocks */}
            <g
              fill={isLate ? "#eef4f0" : "#f6faf7"}
              stroke={isLate ? "#ccdcd4" : "#d5e4dc"}
              strokeWidth="1.5"
              className="transition-colors duration-700"
            >
              {/* Northwest blocks */}
              <rect x="50" y="30" width="105" height="70" rx="10" />
              <rect x="180" y="30" width="115" height="70" rx="10" />
              <rect x="320" y="30" width="110" height="70" rx="10" />
              <rect x="455" y="30" width="125" height="70" rx="10" />

              {/* Mid-North blocks */}
              <rect x="50" y="125" width="105" height="75" rx="10" />
              <rect x="180" y="125" width="115" height="50" rx="10" />
              <rect x="320" y="125" width="110" height="50" rx="10" />
              <rect x="455" y="125" width="125" height="50" rx="10" />

              {/* Mid blocks */}
              <rect x="50" y="225" width="65" height="115" rx="10" />
              <rect x="145" y="240" width="95" height="100" rx="10" />
              <rect x="475" y="245" width="115" height="110" rx="10" />
              <rect x="615" y="120" width="115" height="90" rx="10" />
              <rect x="615" y="235" width="115" height="120" rx="10" />

              {/* South blocks */}
              <rect x="175" y="435" width="110" height="75" rx="10" />
              <rect x="310" y="415" width="130" height="90" rx="10" />
              <rect x="465" y="415" width="125" height="90" rx="10" />
              <rect x="615" y="375" width="115" height="130" rx="10" />
            </g>

            {/* =================================================
                STREET GRID NETWORK
            ================================================= */}
            {/* Secondary Cross-Streets */}
            <g
              stroke={isLate ? "#cbdad3" : "#d5e2dc"}
              strokeWidth="3"
              strokeLinecap="round"
              className="transition-colors duration-700"
            >
              <path d="M 0 65 L 820 65" />
              <path d="M 0 345 L 270 345" />
              <path d="M 445 345 L 820 345" />
              <path d="M 0 495 L 820 495" />
              <path d="M 105 0 L 105 540" />
              <path d="M 235 0 L 235 540" />
              <path d="M 445 0 L 445 540" />
              <path d="M 590 0 L 590 540" />
            </g>

            {/* Major Municipal Avenues (Clean White Cartographic Arterials) */}
            <g
              stroke="#ffffff"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 0 150 L 820 150" />
              <path d="M 0 200 L 820 200" />
              <path d="M 0 395 L 820 395" />
              <path d="M 140 0 L 140 540" />
              <path d="M 300 0 L 300 255" />
              <path d="M 300 370 L 300 540" />
              <path d="M 680 0 L 680 540" />
            </g>

            {/* Street Names */}
            <g fill="#94a3b8" fontSize="8" fontWeight="600" letterSpacing="0.12em">
              <text x="32" y="144">TRANSIT WAY</text>
              <text x="32" y="390">COMMERCIAL AVE</text>
              <text x="686" y="270">NORTH PKWY</text>
              <text x="290" y="315" fill="#475569">BOTANIC GARDENS</text>
            </g>

            {/* =================================================
                ONE SINGLE CONTINUOUS ROUTE
                EXACT SAME GEOMETRY AT BOTH TIMES
            ================================================= */}

            {/* 1. Base Underglow (Adapts color/intensity to time) */}
            <path
              d={singleRoutePath}
              stroke={isLate ? "#34D399" : "#60A5FA"}
              strokeWidth="20"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isLate ? 0.35 : 0.45}
              className="transition-all duration-500"
            />

            {/* 2. Main Route Line (Single Continuous Path) */}
            <path
              d={singleRoutePath}
              stroke={isLate ? "url(#routeNightGrad)" : "url(#routeDayGrad)"}
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-500"
            />

            {/* 3. Directional Flow Dashes along the Route */}
            <path
              d={singleRoutePath}
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeDasharray={isLate ? "5 9" : "4 8"}
              strokeLinecap="round"
              opacity="0.9"
            />

            {/* =================================================
                START & DESTINATION ANCHORS (Exact Same Points)
            ================================================= */}
            {/* Start Anchor: (140, 395) */}
            <g transform="translate(140, 395)">
              <circle r="17" fill="#07111F" opacity="0.12" />
              <circle r="9" fill="#07111F" stroke="#ffffff" strokeWidth="2.5" />
              <circle r="3.5" fill="#ffffff" />
            </g>

            {/* Destination Anchor: (680, 150) */}
            <g transform="translate(680, 150)">
              <circle r="18" fill="#10B981" opacity="0.2" />
              <circle r="10" fill="#10B981" stroke="#ffffff" strokeWidth="2.5" />
              <circle r="4" fill="#ffffff" />
            </g>
          </svg>

          {/* =================================================
              ON-MAP PINS & CALLOUTS
          ================================================= */}
          {/* Start Badge */}
          <div className="pointer-events-none absolute left-[8%] top-[71%] z-20 -translate-y-full sm:left-[11%] sm:top-[73%]">
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-[#07111F] px-2.5 py-1 text-[10px] font-semibold text-white shadow-md sm:px-3 sm:py-1.5 sm:text-xs">
              <MapPin size={12} className="text-emerald-400" />
              <span>START: Central Station</span>
            </div>
          </div>

          {/* Destination Badge */}
          <div className="pointer-events-none absolute right-[7%] top-[16%] z-20 -translate-y-full sm:right-[10%] sm:top-[18%]">
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white shadow-md sm:px-3 sm:py-1.5 sm:text-xs">
              <CheckCircle2 size={12} className="text-white" />
              <span>DESTINATION: Home</span>
            </div>
          </div>

          {/* Core Concept Banner (Top Center-Left) */}
          <div className="pointer-events-none absolute left-4 top-3 z-20 sm:left-6 sm:top-4">
            <div className="rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-700 shadow-xs backdrop-blur-md sm:text-[10px]">
              Same Route • {selectedTime}
            </div>
          </div>

          {/* =================================================
              CONTEXTUAL CALLOUTS ALONG THE ROUTE
              (Directly switches with selected time)
          ================================================= */}
          <AnimatePresence mode="wait">
            {!isLate ? (
              // 6:00 PM CONTEXT CALLOUTS
              <motion.div
                key="day-context"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="pointer-events-none"
              >
                {/* Mid-point callout */}
                <div className="absolute left-[36%] top-[48%] z-20">
                  <div className="rounded-xl border border-blue-200/90 bg-white/95 px-2.5 py-1.5 shadow-sm backdrop-blur-md sm:px-3 sm:py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                      <span className="text-[10px] font-bold text-blue-900 sm:text-xs">
                        6:00 PM: Active Area
                      </span>
                    </div>
                    <p className="mt-0.5 text-[9px] font-medium text-slate-500 sm:text-[10px]">
                      High pedestrian footfall • Good daylight
                    </p>
                  </div>
                </div>

                {/* Point 1 icon badge */}
                <div className="absolute left-[24%] top-[70%] hidden -translate-x-1/2 rounded-full border border-blue-200 bg-white/95 px-2 py-1 text-[9px] font-semibold text-blue-700 shadow-xs sm:flex sm:items-center sm:gap-1">
                  <Users size={11} />
                  <span>Busy market</span>
                </div>

                {/* Point 2 icon badge */}
                <div className="absolute left-[58%] top-[33%] hidden -translate-x-1/2 rounded-full border border-blue-200 bg-white/95 px-2 py-1 text-[9px] font-semibold text-blue-700 shadow-xs sm:flex sm:items-center sm:gap-1">
                  <Store size={11} />
                  <span>Open shops</span>
                </div>
              </motion.div>
            ) : (
              // 11:30 PM CONTEXT CALLOUTS
              <motion.div
                key="night-context"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="pointer-events-none"
              >
                {/* Mid-point callout */}
                <div className="absolute left-[36%] top-[48%] z-20">
                  <div className="rounded-xl border border-amber-300/90 bg-white/95 px-2.5 py-1.5 shadow-sm backdrop-blur-md sm:px-3 sm:py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-[10px] font-bold text-amber-900 sm:text-xs">
                        11:30 PM: Reduced Lighting
                      </span>
                    </div>
                    <p className="mt-0.5 text-[9px] font-medium text-slate-600 sm:text-[10px]">
                      Lower activity • 2 Verified help points
                    </p>
                  </div>
                </div>

                {/* Point 1 icon badge */}
                <div className="absolute left-[24%] top-[70%] hidden -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 px-2 py-1 text-[9px] font-semibold text-slate-600 shadow-xs sm:flex sm:items-center sm:gap-1">
                  <Users size={11} className="text-slate-400" />
                  <span>Low activity</span>
                </div>

                {/* Point 2 icon badge: Caution unlit lamps */}
                <div className="absolute left-[47%] top-[40%] hidden -translate-x-1/2 rounded-full border border-amber-300 bg-amber-50/95 px-2 py-1 text-[9px] font-semibold text-amber-800 shadow-xs sm:flex sm:items-center sm:gap-1">
                  <AlertTriangle size={11} className="text-amber-600" />
                  <span>Unlit lamps</span>
                </div>

                {/* Point 3 icon badge: 24/7 help point */}
                <div className="absolute left-[62%] top-[33%] hidden -translate-x-1/2 rounded-full border border-emerald-300 bg-emerald-50/95 px-2 py-1 text-[9px] font-semibold text-emerald-800 shadow-xs sm:flex sm:items-center sm:gap-1">
                  <LifeBuoy size={11} className="text-emerald-600" />
                  <span>Help desk active</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* -------------------------------------------------
            BOTTOM TELEMETRY PANEL: Direct Context Comparison
        ------------------------------------------------- */}
        <div className="border-t border-slate-200/80 bg-slate-50/95 p-3.5 sm:p-4">
          <div className="flex flex-col gap-3">
            {/* Header / State indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    !isLate ? "bg-blue-600" : "bg-amber-500"
                  }`}
                />
                <span className="text-xs font-bold text-slate-900 sm:text-sm">
                  Route Context at {selectedTime}
                </span>
              </div>
              <span className="text-[10px] font-medium text-slate-500 sm:text-[11px]">
                Toggle time above to inspect conditions
              </span>
            </div>

            {/* 3 Telemetry context indicators */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Context Indicator 1: Activity */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3">
                <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[10px]">
                  <Users size={12} />
                  <span>Activity</span>
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-800 sm:text-xs">
                  {!isLate ? "High Footfall" : "Lower Activity"}
                </p>
                <p className="mt-0.5 hidden text-[9px] text-slate-500 sm:block">
                  {!isLate ? "Bustling evening market" : "Quiet commercial streets"}
                </p>
              </div>

              {/* Context Indicator 2: Lighting */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3">
                <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[10px]">
                  <Lightbulb size={12} />
                  <span>Lighting</span>
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-800 sm:text-xs">
                  {!isLate ? "Good Lighting" : "Reduced Lighting"}
                </p>
                <p className="mt-0.5 hidden text-[9px] text-slate-500 sm:block">
                  {!isLate ? "Daylight & active lamps" : "Sparse mid-avenue lighting"}
                </p>
              </div>

              {/* Context Indicator 3: Help Points & Surroundings */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3">
                <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[10px]">
                  <Shield size={12} />
                  <span>Safety Context</span>
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-800 sm:text-xs">
                  {!isLate ? "Active Shops" : "2 Help Points"}
                </p>
                <p className="mt-0.5 hidden text-[9px] text-slate-500 sm:block">
                  {!isLate ? "Staffed storefronts open" : "Verified 24/7 emergency desks"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}