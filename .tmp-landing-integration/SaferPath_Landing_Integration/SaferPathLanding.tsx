import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Check,
  Clock3,
  Compass,
  Info,
  Leaf,
  Lightbulb,
  LockKeyhole,
  Menu,
  Moon,
  Navigation,
  PhoneCall,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

type RouteKey = "A" | "B" | "C";
type TimeOption = "6:00 PM" | "9:00 PM" | "11:30 PM";
type RouteInfo = { band: string; bandTone: string; duration: string; walk: string; confidence: string; note: string };
type TimeScenario = { eyebrow: string; headline: string; subline: string; routeA: RouteInfo; routeB: RouteInfo; routeC: RouteInfo; selected: RouteKey };

const timeData: Record<TimeOption, TimeScenario> = {
  "6:00 PM": {
    eyebrow: "Before the evening settles",
    headline: "Route A is the cleanest fit.",
    subline: "Fastest, direct, and supported by active frontage on most of the journey.",
    routeA: { band: "Good context", bandTone: "good", duration: "24 min", walk: "1.8 km", confidence: "High", note: "Active frontage through most segments" },
    routeB: { band: "Stronger support", bandTone: "strong", duration: "29 min", walk: "2.2 km", confidence: "High", note: "Two verified help points nearby" },
    routeC: { band: "Mixed context", bandTone: "mixed", duration: "26 min", walk: "2.0 km", confidence: "Medium", note: "One segment has limited lighting data" },
    selected: "A",
  },
  "9:00 PM": {
    eyebrow: "When the last rush thins out",
    headline: "Route B starts to make more sense.",
    subline: "A slightly longer route with stronger activity evidence along the final walk.",
    routeA: { band: "Mixed context", bandTone: "mixed", duration: "24 min", walk: "1.8 km", confidence: "Medium", note: "Activity evidence falls after the station" },
    routeB: { band: "Stronger support", bandTone: "strong", duration: "29 min", walk: "2.2 km", confidence: "High", note: "Active frontage + two verified help points" },
    routeC: { band: "Limited data", bandTone: "limited", duration: "26 min", walk: "2.0 km", confidence: "Low", note: "Final segment has incomplete evidence" },
    selected: "B",
  },
  "11:30 PM": {
    eyebrow: "For the final walk home",
    headline: "Route B has stronger contextual support.",
    subline: "Four minutes longer, but with stronger lighting evidence and verified help points.",
    routeA: { band: "Caution segment", bandTone: "caution", duration: "24 min", walk: "1.8 km", confidence: "Medium", note: "700 m with incomplete lighting data" },
    routeB: { band: "Stronger support", bandTone: "strong", duration: "29 min", walk: "2.2 km", confidence: "Medium", note: "Two verified help points within 250 m" },
    routeC: { band: "Stale evidence", bandTone: "stale", duration: "26 min", walk: "2.0 km", confidence: "Low", note: "Lighting source last verified 12 days ago" },
    selected: "B",
  },
} as const;

const timeOptions: TimeOption[] = ["6:00 PM", "9:00 PM", "11:30 PM"];

function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <a href="#top" className="flex items-center gap-3" aria-label="SaferPath home">
      <span className={`grid h-10 w-10 place-items-center rounded-[14px] ${inverse ? "bg-[#f4f0e7] text-[#163b37]" : "bg-[#163b37] text-[#f4f0e7] shadow-[0_10px_25px_rgba(22,59,55,.18)]"}`}>
        <Route size={19} strokeWidth={2.2} />
      </span>
      <span className={`text-[17px] font-semibold tracking-[-0.03em] ${inverse ? "text-[#f4f0e7]" : "text-[#163b37]"}`}>SaferPath</span>
    </a>
  );
}

function ContextPill({ tone, children }: { tone: string; children: ReactNode }) {
  const styles: Record<string, string> = {
    strong: "border-[#b7d5c7] bg-[#e6f0e9] text-[#21594b]",
    good: "border-[#c9dfd3] bg-[#eff5ef] text-[#356752]",
    mixed: "border-[#e8d2a4] bg-[#faf1dd] text-[#765725]",
    limited: "border-[#ddd6c7] bg-[#f1eee6] text-[#666258]",
    caution: "border-[#e9b7a9] bg-[#fbedeb] text-[#934d3d]",
    stale: "border-[#d2c5b8] bg-[#f2eae3] text-[#77594b]",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles[tone] || styles.limited}`}>{children}</span>;
}

function DemoMap({ selected, activeTime }: { selected: RouteKey; activeTime: TimeOption }) {
  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-[24px] border border-[#d8d4ca] bg-[#e7e5dd] shadow-[0_20px_60px_rgba(30,44,39,.08)] sm:min-h-[500px]">
      <div className="map-grid absolute inset-0 opacity-60" />
      <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
      <div className="map-label label-one">Cedar Avenue</div><div className="map-label label-two">North Station</div><div className="map-label label-three">Riverside Walk</div>
      <svg viewBox="0 0 600 500" className="absolute inset-0 h-full w-full" role="img" aria-label={`Illustrated route context at ${activeTime}`}>
        <path d="M90 410 C160 360 150 270 230 260 S310 190 350 118 S438 88 515 60" className={`route-line route-a ${selected === "A" ? "route-selected" : ""}`} />
        <path d="M88 410 C170 400 220 350 250 300 S300 268 365 245 S420 170 515 60" className={`route-line route-b ${selected === "B" ? "route-selected" : ""}`} />
        <path d="M88 410 C115 350 210 335 260 350 S360 390 410 300 S465 145 515 60" className={`route-line route-c ${selected === "C" ? "route-selected" : ""}`} />
        <circle cx="90" cy="410" r="10" className="map-pin-start" /><circle cx="515" cy="60" r="10" className="map-pin-end" />
        <circle cx="365" cy="245" r="8" className="help-dot" /><circle cx="420" cy="170" r="8" className="help-dot" />
        <circle cx="235" cy="260" r="7" className="light-dot" /><circle cx="300" cy="270" r="7" className="light-dot" />
      </svg>
      <div className="absolute left-4 top-4 rounded-2xl border border-white/70 bg-[#f8f6f0]/90 px-3 py-2 text-[11px] font-semibold text-[#4a554f] shadow-sm backdrop-blur-sm sm:left-5 sm:top-5">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[.14em] text-[#88877e]">Pilot area</div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#70a98e]" /> Context updated for {activeTime}</div>
      </div>
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between sm:bottom-5 sm:left-5 sm:right-5">
        <div className="flex gap-2 rounded-2xl border border-white/70 bg-[#f8f6f0]/90 p-2 text-[10px] font-medium text-[#68716b] shadow-sm backdrop-blur-sm">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#8bbfa5]" /> Stronger support</span>
          <span className="hidden items-center gap-1.5 sm:flex"><i className="h-2 w-2 rounded-full bg-[#d78670]" /> Caution</span>
        </div>
        <span className="rounded-full bg-[#163b37] px-3 py-2 font-mono text-[10px] uppercase tracking-[.12em] text-[#f4f0e7]">2.6 km view</span>
      </div>
    </div>
  );
}

function RouteCard({ route, data, selected, onSelect, onExplain }: { route: RouteKey; data: (typeof timeData)[keyof typeof timeData]["routeA"]; selected: boolean; onSelect: () => void; onExplain: () => void }) {
  return (
    <article className={`route-card ${selected ? "route-card-selected" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3"><span className={`route-letter ${selected ? "route-letter-selected" : ""}`}>{route}</span><div><div className="font-semibold text-[#183b37]">Route {route}</div><div className="mt-0.5 text-xs text-[#7a7b72]">{data.duration} · {data.walk} walking</div></div></div>
        <ContextPill tone={data.bandTone}>{data.band}</ContextPill>
      </div>
      <div className="mt-4 flex items-start gap-2 text-sm leading-5 text-[#4f5a54]"><Lightbulb size={15} className="mt-0.5 shrink-0 text-[#bf815e]" /><span>{data.note}</span></div>
      <div className="mt-4 flex items-center justify-between border-t border-[#e5e0d6] pt-3 text-[11px] text-[#85857b]"><span>Context confidence</span><span className="font-mono font-semibold text-[#52645d]">{data.confidence}</span></div>
      <div className="mt-3 flex gap-2"><button onClick={onSelect} className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${selected ? "bg-[#163b37] text-[#f7f4ec]" : "border border-[#d8d4ca] bg-transparent text-[#31534a] hover:bg-[#f3efe7]"}`}>{selected ? <span className="flex items-center justify-center gap-1.5"><Check size={14} /> Selected</span> : "Choose route"}</button><button onClick={onExplain} className="rounded-xl border border-[#d8d4ca] px-3 py-2.5 text-xs font-semibold text-[#31534a] transition hover:bg-[#f3efe7]" aria-label={`Why route ${route}`}>Why this route</button></div>
    </article>
  );
}

export default function Home() {
  const [activeTime, setActiveTime] = useState<TimeOption>("11:30 PM");
  const [selected, setSelected] = useState<RouteKey>("B");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [explainRoute, setExplainRoute] = useState<RouteKey | null>(null);
  const current = timeData[activeTime];
  const explainData = explainRoute ? current[`route${explainRoute}` as "routeA" | "routeB" | "routeC"] : null;
  const routeInsight = useMemo(() => explainRoute === "A" ? "Route A is four minutes faster, but its final 700 metres have incomplete lighting evidence at this time." : explainRoute === "C" ? "Route C has a shorter walking distance, but its evidence is limited or stale for the final segment." : "Route B has two verified help points within 250 metres and stronger lighting evidence through the final walk.", [explainRoute]);

  const scrollToDemo = () => document.getElementById("route-demo")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div id="top" className="min-h-screen overflow-x-hidden bg-[#f8f6f0] text-[#183b37]">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#e7e1d7]/80 bg-[#f8f6f0]/88 backdrop-blur-xl">
        <div className="container flex h-[72px] items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-medium text-[#59716a] lg:flex" aria-label="Primary navigation"><a href="#lens" className="transition hover:text-[#183b37]">The lens</a><a href="#evidence" className="transition hover:text-[#183b37]">Evidence</a><a href="#privacy" className="transition hover:text-[#183b37]">Privacy</a><a href="#partners" className="transition hover:text-[#183b37]">For partners</a></nav>
          <div className="hidden items-center gap-3 sm:flex"><button className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#31534a] transition hover:bg-[#eee9df]" onClick={() => alert("Sign in will be available in the traveller PWA.")}>Sign in</button><button onClick={scrollToDemo} className="rounded-full bg-[#163b37] px-5 py-2.5 text-sm font-semibold text-[#f7f4ec] shadow-[0_8px_18px_rgba(22,59,55,.18)] transition hover:-translate-y-0.5">Try route planning <ArrowUpRight size={15} className="ml-1.5 inline" /></button></div>
          <button className="rounded-xl p-2 lg:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        {mobileOpen && <div className="border-t border-[#e7e1d7] bg-[#f8f6f0] px-5 py-5 lg:hidden"><div className="flex flex-col gap-4 text-sm font-semibold text-[#31534a]"><a href="#lens" onClick={() => setMobileOpen(false)}>The lens</a><a href="#evidence" onClick={() => setMobileOpen(false)}>Evidence</a><a href="#privacy" onClick={() => setMobileOpen(false)}>Privacy</a><a href="#partners" onClick={() => setMobileOpen(false)}>For partners</a><button onClick={scrollToDemo} className="mt-1 rounded-full bg-[#163b37] px-4 py-3 text-left text-[#f7f4ec]">Try route planning <ArrowRight className="float-right" size={16} /></button></div></div>}
      </header>

      <main>
        <section className="hero-section relative pt-[72px]">
          <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
          <div className="container relative grid items-center gap-14 pb-20 pt-20 md:pb-28 md:pt-28 lg:grid-cols-[.92fr_1.08fr] lg:gap-16 lg:pt-32">
            <div className="max-w-xl"><div className="eyebrow"><span className="eyebrow-dot" /> Time-aware route context</div><h1 className="mt-7 max-w-[610px] font-serif text-[clamp(3.25rem,6vw,6.2rem)] font-medium leading-[.94] tracking-[-.065em] text-[#173b36]">The route nobody <em className="font-serif text-[#b86c50]">warned her</em> about.</h1><p className="mt-7 max-w-lg text-[17px] leading-8 text-[#5d6d65] md:text-[19px]">SaferPath helps you compare everyday routes using the context that changes when you travel: lighting, activity, help points, community reports, and what the evidence does not know.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><button onClick={scrollToDemo} className="group rounded-full bg-[#c9785f] px-6 py-3.5 text-sm font-bold text-[#fffaf3] shadow-[0_12px_28px_rgba(201,120,95,.22)] transition hover:-translate-y-0.5">See the route change <ArrowRight size={16} className="ml-2 inline transition group-hover:translate-x-1" /></button><a href="#lens" className="rounded-full border border-[#cbd1c7] px-6 py-3.5 text-center text-sm font-bold text-[#31534a] transition hover:bg-[#eee9df]">How it works</a></div><p className="mt-5 flex items-center gap-2 text-xs text-[#7e857e]"><ShieldCheck size={14} className="text-[#6aa187]" /> No guarantees. No permanent tracking by default. Your choice stays yours.</p></div>
            <div className="hero-visual relative"><div className="hero-note note-top"><span className="note-kicker">A route is not static</span><span className="note-copy">Context changes with the hour you arrive.</span></div><div className="hero-map-shell"><DemoMap selected={selected} activeTime={activeTime} /></div><div className="hero-note note-bottom"><span className="note-icon"><Clock3 size={15} /></span><span><strong>11:30 PM</strong><br /><small>evidence matched to arrival time</small></span></div></div>
          </div>
          <div className="container pb-12"><div className="border-y border-[#e2ddd3] py-5"><div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 text-xs font-semibold uppercase tracking-[.15em] text-[#8a8c83]"><span>Built for real everyday journeys</span><span className="flex items-center gap-2"><Compass size={15} /> campus corridors</span><span className="flex items-center gap-2"><Moon size={15} /> late commutes</span><span className="flex items-center gap-2"><Users size={15} /> new neighbourhoods</span><span className="flex items-center gap-2"><Leaf size={15} /> privacy by design</span></div></div></div>
        </section>

        <section id="lens" className="section-pad bg-[#163b37] text-[#f5f2e9]"><div className="container grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-24"><div><div className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> The context gap</div><h2 className="mt-6 max-w-md font-serif text-4xl leading-[1.02] tracking-[-.045em] md:text-6xl">Fastest is not always the route you can use.</h2><p className="mt-6 max-w-md text-[16px] leading-7 text-[#c4d3c8]">Standard navigation is built around time, distance, traffic, and convenience. SaferPath adds a time-window lens for the last stretch of the journey.</p><a href="#route-demo" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#dcebdd] underline decoration-[#7fb59a] underline-offset-8">Try the time lens <ArrowDownRight size={16} /></a></div><div className="grid gap-4 sm:grid-cols-3"><div className="dark-card"><span className="step-number">01</span><Lightbulb className="mt-12 text-[#cce1bc]" size={23} /><h3 className="mt-6 text-lg font-semibold">See the evidence</h3><p className="mt-3 text-sm leading-6 text-[#acc2b3]">Lighting, activity, isolation, help points, reports, and route continuity.</p></div><div className="dark-card"><span className="step-number">02</span><Clock3 className="mt-12 text-[#d6ba8a]" size={23} /><h3 className="mt-6 text-lg font-semibold">Match the time</h3><p className="mt-3 text-sm leading-6 text-[#acc2b3]">Every segment is interpreted for when you are expected to reach it.</p></div><div className="dark-card"><span className="step-number">03</span><Navigation className="mt-12 text-[#e2a491]" size={23} /><h3 className="mt-6 text-lg font-semibold">Choose for yourself</h3><p className="mt-3 text-sm leading-6 text-[#acc2b3]">No forced ranking. Just a clearer view of the trade-offs.</p></div></div></div></section>

        <section id="route-demo" className="section-pad bg-[#f1eee6]"><div className="container"><div className="mx-auto max-w-2xl text-center"><div className="eyebrow justify-center"><span className="eyebrow-dot" /> The Time-Window Lens</div><h2 className="mt-5 font-serif text-4xl leading-[1.04] tracking-[-.045em] text-[#173b36] md:text-6xl">Watch the same route tell a different story.</h2><p className="mt-5 text-[16px] leading-7 text-[#69736c]">Move through the evening and see how evidence changes. This is a seeded pilot-area demo, not a live safety guarantee.</p></div><div className="mt-12 grid gap-5 lg:grid-cols-[1.18fr_.82fr] lg:items-start"><div className="order-2 lg:order-1"><DemoMap selected={selected} activeTime={activeTime} /><div className="mt-4 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-2 text-xs text-[#777a72]"><Info size={14} /> Context is evidence, not certainty.</div><button className="text-xs font-bold text-[#31534a] underline underline-offset-4" onClick={() => alert("Text route summary would open here in the traveller PWA.")}>View text route summary</button></div></div><div className="order-1 lg:order-2"><div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Select travel time">{timeOptions.map((time) => <button key={time} role="tab" aria-selected={activeTime === time} onClick={() => { setActiveTime(time); setSelected(timeData[time].selected); }} className={`time-tab ${activeTime === time ? "time-tab-active" : ""}`}>{time}</button>)}</div><div className="rounded-[24px] border border-[#ddd8ce] bg-[#f8f6f0] p-5 shadow-[0_14px_34px_rgba(38,48,39,.06)] sm:p-6"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#9a968c]">{current.eyebrow}</div><h3 className="mt-3 font-serif text-3xl leading-[1.05] tracking-[-.04em] text-[#173b36]">{current.headline}</h3><p className="mt-3 text-sm leading-6 text-[#6a746d]">{current.subline}</p><div className="mt-6 space-y-3"><RouteCard route="A" data={current.routeA} selected={selected === "A"} onSelect={() => setSelected("A")} onExplain={() => setExplainRoute("A")} /><RouteCard route="B" data={current.routeB} selected={selected === "B"} onSelect={() => setSelected("B")} onExplain={() => setExplainRoute("B")} /><RouteCard route="C" data={current.routeC} selected={selected === "C"} onSelect={() => setSelected("C")} onExplain={() => setExplainRoute("C")} /></div></div></div></div></div></section>

        <section id="evidence" className="section-pad bg-[#f8f6f0]"><div className="container"><div className="grid items-end gap-8 border-b border-[#e2ddd3] pb-10 md:grid-cols-[.9fr_1.1fr]"><div><div className="eyebrow"><span className="eyebrow-dot" /> Evidence, made legible</div><h2 className="mt-5 max-w-lg font-serif text-4xl leading-[1.04] tracking-[-.045em] text-[#173b36] md:text-6xl">A calmer way to make a route decision.</h2></div><p className="max-w-xl text-[16px] leading-7 text-[#69736c]">We do not compress a complex street into one opaque score. SaferPath shows what supports a route, what needs attention, and what remains unknown.</p></div><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4"><div className="evidence-tile"><span className="tile-icon mint"><Lightbulb size={19} /></span><h3>Lighting evidence</h3><p>Coverage, last verified, and confidence—not a permanent street label.</p></div><div className="evidence-tile"><span className="tile-icon sand"><Users size={19} /></span><h3>Activity nearby</h3><p>Open frontage and time-matched activity proxies along the journey.</p></div><div className="evidence-tile"><span className="tile-icon coral"><PhoneCall size={19} /></span><h3>Help points</h3><p>Verified places, opening status, accessibility, and freshness.</p></div><div className="evidence-tile"><span className="tile-icon ink"><BellRing size={19} /></span><h3>Recent reports</h3><p>Structured, coarse, moderated context with corroboration limits.</p></div></div></div></section>

        <section id="privacy" className="section-pad border-y border-[#e2ddd3] bg-[#eae7dd]"><div className="container grid gap-12 lg:grid-cols-[.86fr_1.14fr] lg:gap-24"><div><div className="eyebrow"><span className="eyebrow-dot" /> Control is a feature</div><h2 className="mt-5 max-w-md font-serif text-4xl leading-[1.04] tracking-[-.045em] text-[#173b36] md:text-6xl">Privacy should make a safety product feel safer.</h2><p className="mt-6 max-w-md text-[16px] leading-7 text-[#69736c]">Plan without an account. Add a trusted contact only when you want one. Share a trip for a limited time. Stop sharing with one tap.</p><a href="#partners" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#31534a] underline decoration-[#c9785f] underline-offset-8">Read the privacy promise <ArrowRight size={16} /></a></div><div className="grid gap-3 sm:grid-cols-2"><div className="privacy-item"><LockKeyhole size={19} /><div><strong>Private by default</strong><p>Saved places and route history are not public context.</p></div></div><div className="privacy-item"><Clock3 size={19} /><div><strong>Time-limited sharing</strong><p>Trusted-contact access expires or can be revoked.</p></div></div><div className="privacy-item"><ShieldCheck size={19} /><div><strong>Honest boundaries</strong><p>No emergency claims without official confirmation.</p></div></div><div className="privacy-item"><Leaf size={19} /><div><strong>Less data, more control</strong><p>Route planning works without continuous tracking.</p></div></div></div></div></section>

        <section id="partners" className="section-pad bg-[#f8f6f0]"><div className="container grid items-center gap-10 lg:grid-cols-[1fr_.95fr]"><div><div className="eyebrow"><span className="eyebrow-dot" /> For pilot partners</div><h2 className="mt-5 max-w-xl font-serif text-4xl leading-[1.04] tracking-[-.045em] text-[#173b36] md:text-6xl">Start with one corridor. Learn what people can trust.</h2><p className="mt-6 max-w-xl text-[16px] leading-7 text-[#69736c]">Campuses, employers, business districts, NGOs, and city programmes can pilot SaferPath in a bounded area with verified help points, moderated context, and aggregate learning.</p><button onClick={() => alert("Pilot conversations are coming soon.")} className="mt-8 rounded-full bg-[#163b37] px-6 py-3.5 text-sm font-bold text-[#f7f4ec] transition hover:-translate-y-0.5">Talk about a pilot <ArrowUpRight size={15} className="ml-1.5 inline" /></button></div><div className="partner-card"><div className="flex items-start justify-between"><span className="rounded-full bg-[#e6f0e9] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#2e6651]">Pilot model</span><Sparkles size={20} className="text-[#c9785f]" /></div><h3 className="mt-7 font-serif text-3xl tracking-[-.035em] text-[#173b36]">A small geography is a feature, not a limitation.</h3><div className="mt-7 space-y-4">{["Map and verify a bounded area", "Recruit a small traveller cohort", "Measure route-choice understanding", "Improve context quality and accessibility"].map((item, index) => <div key={item} className="flex items-center gap-3 border-b border-[#dfdacf] pb-4 text-sm font-semibold text-[#50635b]"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#163b37] font-mono text-[10px] text-[#f8f6f0]">0{index + 1}</span>{item}<Check className="ml-auto text-[#7baa91]" size={16} /></div>)}</div></div></div></section>

        <section className="overflow-hidden bg-[#c9785f] text-[#fff9f1]"><div className="container grid gap-8 py-16 md:grid-cols-[1fr_auto] md:items-center md:py-20"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ffe1d4]">The product promise</p><h2 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.03] tracking-[-.045em] md:text-6xl">More context. More control. No false certainty.</h2></div><button onClick={scrollToDemo} className="w-fit rounded-full bg-[#fff9f1] px-6 py-3.5 text-sm font-bold text-[#9d563f] transition hover:-translate-y-0.5">Explore the demo <ArrowRight size={16} className="ml-2 inline" /></button></div></section>
      </main>

      <footer className="bg-[#163b37] text-[#d5e1d7]"><div className="container grid gap-12 py-12 md:grid-cols-[1fr_auto_auto] md:py-16"><div><Logo inverse /><p className="mt-5 max-w-xs text-sm leading-6 text-[#9eb8a8]">Time-aware route context for the journeys that matter.</p></div><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#7fa18d]">Explore</div><div className="mt-4 flex flex-col gap-3 text-sm"><a href="#lens" className="hover:text-white">The lens</a><a href="#evidence" className="hover:text-white">Evidence</a><a href="#privacy" className="hover:text-white">Privacy</a></div></div><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#7fa18d]">Boundary</div><p className="mt-4 max-w-xs text-sm leading-6 text-[#9eb8a8]">SaferPath does not certify a street as safe, predict crime, or replace official emergency services.</p></div></div><div className="container flex flex-col gap-3 border-t border-[#3b5a51] py-6 text-xs text-[#85a393] sm:flex-row sm:items-center sm:justify-between"><span>© 2026 SaferPath. Built for informed journeys.</span><span className="flex items-center gap-2"><ShieldCheck size={13} /> Privacy-first by design</span></div></footer>

      {explainRoute && explainData && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#102e2a]/35 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="route-explanation-title"><div className="w-full max-w-lg rounded-t-[28px] bg-[#f8f6f0] p-6 shadow-2xl sm:rounded-[28px] sm:p-8"><div className="flex items-start justify-between"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#9a968c]">Route {explainRoute} · {activeTime}</div><h2 id="route-explanation-title" className="mt-3 font-serif text-3xl tracking-[-.04em] text-[#173b36]">Why this route?</h2></div><button className="rounded-full p-2 text-[#65726b] hover:bg-[#ece8de]" onClick={() => setExplainRoute(null)} aria-label="Close explanation"><X size={20} /></button></div><div className="mt-6 rounded-2xl border border-[#d9e3d7] bg-[#edf4ed] p-4"><div className="flex items-start gap-3"><Sparkles size={18} className="mt-0.5 text-[#47765e]" /><p className="text-sm leading-6 text-[#466254]">{routeInsight}</p></div></div><div className="mt-5 grid gap-3 text-sm"><div className="flex items-center justify-between border-b border-[#e5e0d6] pb-3"><span className="text-[#7a7d73]">Context band</span><ContextPill tone={explainData.bandTone}>{explainData.band}</ContextPill></div><div className="flex items-center justify-between border-b border-[#e5e0d6] pb-3"><span className="text-[#7a7d73]">Evidence freshness</span><span className="font-semibold text-[#31534a]">{activeTime === "11:30 PM" && explainRoute === "A" ? "Mixed" : "Recent"}</span></div><div className="flex items-center justify-between"><span className="text-[#7a7d73]">Confidence</span><span className="font-mono font-semibold text-[#31534a]">{explainData.confidence}</span></div></div><p className="mt-6 text-xs leading-5 text-[#8a8980]">Evidence is not certainty. SaferPath shows supporting context and limitations so you can make your own decision.</p><button onClick={() => setExplainRoute(null)} className="mt-6 w-full rounded-xl bg-[#163b37] px-4 py-3 text-sm font-semibold text-[#f7f4ec]">Close explanation</button></div></div>}
    </div>
  );
}
