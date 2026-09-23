import { Link } from "react-router-dom";
import {
  ArrowRight,
  Lightbulb,
  Users,
  MapPin,
  Clock,
  Lock,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Radio,
} from "lucide-react";
import { HeroMapPulse } from "../components/landing/HeroMapPulse";
import { TimeContextDemo } from "../components/landing/TimeContextDemo";
import { SaferPathLogo } from "../components/brand/SaferPathLogo";
import { ThemeToggle } from "../components/brand/ThemeToggle";

export function LandingPage() {
  return (
    <div className="landing-shell min-h-screen bg-[var(--paper,#fbfbf9)] text-[var(--ink,#14231d)] font-sans">
      {/* =====================================================
          1. PUBLIC NAVIGATION
      ===================================================== */}
      <header className="sticky top-0 z-50 border-b border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <SaferPathLogo size={32} variant="full" />
          </Link>

          <nav className="hidden items-center gap-7 text-xs font-semibold uppercase tracking-wider text-[var(--muted,#53615a)] md:flex">
            <a href="#how-it-works" className="hover:text-[var(--teal,#16756c)] transition">
              How it works
            </a>
            <a href="#time-context" className="hover:text-[var(--teal,#16756c)] transition">
              Time Lens
            </a>
            <a href="#evidence" className="hover:text-[var(--teal,#16756c)] transition">
              Evidence
            </a>
            <a href="#active-trip" className="hover:text-[var(--teal,#16756c)] transition">
              Active Trip
            </a>
            <a href="#privacy" className="hover:text-[var(--teal,#16756c)] transition">
              Privacy
            </a>
            <a href="#emergency" className="hover:text-[var(--teal,#16756c)] transition">
              Help & 112
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              to="/login"
              className="text-xs font-semibold text-[var(--muted,#53615a)] hover:text-[var(--ink,#14231d)] px-3 py-2 transition"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--teal,#16756c)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#075b53]"
            >
              Get started
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* =====================================================
          2. HERO SECTION
      ===================================================== */}
      <section className="landing-hero relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-24">
        <div className="landing-hero__grid" aria-hidden="true" />
        <div className="landing-hero__orb landing-hero__orb--one" aria-hidden="true" />
        <div className="landing-hero__orb landing-hero__orb--two" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left Content */}
            <div className="landing-reveal lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--teal,#16756c)]/30 bg-[var(--teal-soft,#eef7f4)] px-3.5 py-1 text-xs font-medium text-[var(--teal,#0e5c54)]">
                <span className="h-2 w-2 rounded-full bg-[var(--teal,#16756c)] animate-pulse" />
                Context-aware mobility for urban travellers
              </div>

              <h1 className="mt-6 max-w-xl font-serif text-4xl font-semibold tracking-[-0.06em] text-[var(--ink,#14231d)] sm:text-5xl lg:text-[4.75rem] leading-[0.94]">
                The route nobody <span className="landing-gradient-text italic">warned you</span> about.
              </h1>

              <p className="mt-6 text-base text-[var(--muted,#53615a)] sm:text-lg leading-relaxed max-w-xl">
                Street lighting, pedestrian footpaths, commercial frontage, and
                verified help points — grounded in municipal evidence and
                temporal clarity, never safety guarantees or numeric scores.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--teal,#16756c)] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#075b53]"
                >
                  See the route change
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#time-context"
                  className="inline-flex items-center gap-2 rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] px-5 py-3.5 text-sm font-semibold text-[var(--ink,#14231d)] hover:bg-[var(--hover,#f0f2ed)] transition"
                >
                  See time demo
                </a>
              </div>

              {/* Guarantees bar */}
              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-[var(--line,#d8ddd7)] pt-6 text-xs text-[var(--muted,#53615a)]">
                <div>
                  <span className="font-semibold text-[var(--ink,#14231d)] block">
                    Passwordless OTP
                  </span>
                  Instant email access
                </div>
                <div>
                  <span className="font-semibold text-[var(--ink,#14231d)] block">
                    Zero Tracking
                  </span>
                  No background surveillance
                </div>
                <div>
                  <span className="font-semibold text-[var(--ink,#14231d)] block">
                    Civic Evidence
                  </span>
                  Clear uncertainties stated
                </div>
              </div>
            </div>

            {/* Right 3D Visual */}
            <div className="landing-reveal landing-reveal--late hero-visual-stack lg:col-span-6">
              <HeroMapPulse />
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          3. HOW IT WORKS (4 STEPS)
      ===================================================== */}
      <section
        id="how-it-works"
        className="border-t border-[var(--line,#d8ddd7)] bg-[var(--paper,#f7f6f1)] py-20"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal,#16756c)]">
              Methodology
            </span>
            <h2 className="mt-2 font-serif text-3xl font-bold text-[var(--ink,#14231d)] sm:text-4xl">
              How SaferPath works
            </h2>
            <p className="mt-3 text-base text-[var(--muted,#53615a)]">
              SaferPath does not claim to know which street is "safe." Instead,
              we provide verified context so you can decide the route you feel
              comfortable taking.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Step 1 */}
            <div className="rounded-xl border border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal-soft,#dcefe9)] text-[var(--teal,#16756c)] font-bold text-sm">
                01
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-[var(--ink,#14231d)]">
                Enter where you're going
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted,#53615a)]">
                Search place names like "Shivaji Park" or "Bandra Station",
                choose from your saved routines, or use your current location.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal-soft,#dcefe9)] text-[var(--teal,#16756c)] font-bold text-sm">
                02
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-[var(--ink,#14231d)]">
                Compare route context
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted,#53615a)]">
                See alternative corridors side-by-side with clear indicators of
                continuous illumination, open shops, and pedestrian density.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal-soft,#dcefe9)] text-[var(--teal,#16756c)] font-bold text-sm">
                03
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-[var(--ink,#14231d)]">
                Understand the evidence
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted,#53615a)]">
                Every observation is backed by data freshness and explicit
                notices of what remains uncertain or unobserved along the route.
              </p>
            </div>

            {/* Step 4 */}
            <div className="rounded-xl border border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--teal-soft,#dcefe9)] text-[var(--teal,#16756c)] font-bold text-sm">
                04
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-[var(--ink,#14231d)]">
                Optionally start a trip
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted,#53615a)]">
                Opt-in live GPS tracking with automatic arrival detection, route
                deviation alerts, and immediate session termination when
                completed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          4. TIME CHANGES CONTEXT
      ===================================================== */}
      <section
        id="time-context"
        className="border-t border-[var(--line,#d8ddd7)] bg-[var(--surface,#ffffff)] py-20"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal,#16756c)]">
              Temporal Dynamics
            </span>
            <h2 className="mt-2 font-serif text-3xl font-bold text-[var(--ink,#14231d)] sm:text-4xl">
              Time changes urban context
            </h2>
            <p className="mt-3 text-sm text-[var(--muted,#53615a)]">
              A vibrant high-street during evening rush hour has very different
              physical characteristics at midnight. SaferPath models context
              across dynamic time windows.
            </p>
          </div>

          <TimeContextDemo />
        </div>
      </section>

      {/* =====================================================
          5. EVIDENCE, NOT CERTAINTY
      ===================================================== */}
      <section
        id="evidence"
        className="border-t border-[var(--line,#d8ddd7)] bg-[var(--paper,#f7f6f1)] py-20"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-12 items-center">
            <div className="lg:col-span-5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal,#16756c)]">
                Civic Clarity
              </span>
              <h2 className="mt-2 font-serif text-3xl font-bold text-[var(--ink,#14231d)] sm:text-4xl">
                Evidence, never safety guarantees.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--muted,#53615a)]">
                Traditional safety apps claim to score neighborhoods with red or
                green flags. We reject false certainty. Real cities are dynamic,
                nuanced, and changing.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted,#53615a)]">
                SaferPath provides transparent observations so travellers have
                actionable situational awareness.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[var(--teal,#16756c)] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[var(--ink,#14231d)]">
                      Observed Municipal Lighting
                    </h4>
                    <p className="text-xs text-[var(--muted,#53615a)]">
                      Physical street lamps mapped from municipal GIS and
                      verified field surveys.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[var(--teal,#16756c)] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[var(--ink,#14231d)]">
                      Commercial Frontage Sightlines
                    </h4>
                    <p className="text-xs text-[var(--muted,#53615a)]">
                      Active storefronts and open businesses provide informal
                      observation and street vitality.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[var(--teal,#16756c)] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[var(--ink,#14231d)]">
                      Civic Help Proximity
                    </h4>
                    <p className="text-xs text-[var(--muted,#53615a)]">
                      Verified police aid posts, transit booths, and 24-hour
                      pharmacies with verified coordinates.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-[var(--amber,#9a6400)] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[var(--ink,#14231d)]">
                      Explicit Uncertainty Disclosures
                    </h4>
                    <p className="text-xs text-[var(--muted,#53615a)]">
                      When data is outdated or missing for a stretch of road, we
                      tell you clearly.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual breakdown card */}
            <div className="lg:col-span-7 rounded-2xl border border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] p-6 shadow-sm">
              <div className="border-b border-[var(--line,#e2e6e1)] pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[var(--teal,#16756c)] uppercase tracking-wider">
                    Example Route Context Card
                  </span>
                  <h3 className="font-serif text-xl font-bold text-[var(--ink,#14231d)]">
                    Bandra West Corridor (1.4 km)
                  </h3>
                </div>
                <span className="rounded-full border border-[var(--teal,#16756c)] bg-[var(--teal-soft,#dcefe9)] px-3 py-1 text-xs font-semibold text-[var(--teal,#075b53)]">
                  Well-supported context
                </span>
              </div>

              <div className="mt-5 space-y-4 text-xs">
                <div className="rounded-lg border border-[var(--line,#e2e6e1)] bg-[var(--card,#fbfbf9)] p-4">
                  <div className="font-semibold text-[var(--ink,#14231d)] flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-[var(--teal,#16756c)]" />
                    Street Lighting Profile
                  </div>
                  <p className="mt-1 text-[var(--muted,#53615a)]">
                    Continuous municipal street lamps mapped along 92% of the
                    road length. Fixtures verified active within the last 30
                    days.
                  </p>
                </div>

                <div className="rounded-lg border border-[var(--line,#e2e6e1)] bg-[var(--card,#fbfbf9)] p-4">
                  <div className="font-semibold text-[var(--ink,#14231d)] flex items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--teal,#16756c)]" />
                    Pedestrian Footpath Activity
                  </div>
                  <p className="mt-1 text-[var(--muted,#53615a)]">
                    Regular evening commuter and shopping volume expected until
                    10:30 PM. Transit connections at Bandra Station.
                  </p>
                </div>

                <div className="rounded-lg border border-[var(--line,#e2e6e1)] bg-[var(--card,#fbfbf9)] p-4">
                  <div className="font-semibold text-[var(--ink,#14231d)] flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[var(--amber,#9a6400)]" />
                    Stated Uncertainties
                  </div>
                  <p className="mt-1 text-[var(--muted,#53615a)]">
                    Narrower 80m footpath segment near railway underpass has
                    limited commercial frontage after 11:00 PM.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          6. ACTIVE TRIP & ZERO SURVEILLANCE
      ===================================================== */}
      <section
        id="active-trip"
        className="border-t border-[var(--line,#d8ddd7)] bg-[var(--surface,#ffffff)] py-20"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="rounded-2xl border border-[var(--line,#d8ddd7)] bg-[var(--paper,#f7f6f1)] p-8 sm:p-12">
            <div className="grid gap-8 lg:grid-cols-12 items-center">
              <div className="lg:col-span-7">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal,#16756c)]">
                  Active Trip Engine
                </span>
                <h2 className="mt-2 font-serif text-3xl font-bold text-[var(--ink,#14231d)]">
                  Optional trip tracking. Transparent & opt-in.
                </h2>
                <p className="mt-4 text-sm text-[var(--muted,#53615a)] leading-relaxed">
                  Route planning on SaferPath does not track your location.
                  Continuous GPS is strictly active only when you choose to
                  start a trip and explicitly grant consent.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-4">
                    <Radio className="h-4 w-4 text-sky-600" />
                    <h4 className="mt-2 font-bold text-[var(--ink,#14231d)]">
                      Real Geolocation Breadcrumbs
                    </h4>
                    <p className="mt-1 text-[var(--muted,#53615a)]">
                      Your traveled path is drawn live on your map using your
                      device's browser GPS.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-4">
                    <CheckCircle2 className="h-4 w-4 text-[var(--teal,#16756c)]" />
                    <h4 className="mt-2 font-bold text-[var(--ink,#14231d)]">
                      Automatic Arrival Completion
                    </h4>
                    <p className="mt-1 text-[var(--muted,#53615a)]">
                      When you arrive within 70m of your destination, the trip
                      marks arrived and ceases tracking automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 rounded-xl border border-[var(--line,#d8ddd7)] bg-[var(--surface,#ffffff)] p-6 shadow-xs">
                <h4 className="font-serif text-base font-bold text-[var(--ink,#14231d)]">
                  Privacy Commitments
                </h4>
                <ul className="mt-3 space-y-2.5 text-xs text-[var(--muted,#53615a)]">
                  <li className="flex items-start gap-2">
                    <Lock className="h-3.5 w-3.5 text-[var(--teal,#16756c)] shrink-0 mt-0.5" />
                    <span>
                      No background tracking when the browser tab is closed.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Lock className="h-3.5 w-3.5 text-[var(--teal,#16756c)] shrink-0 mt-0.5" />
                    <span>
                      Shared trips with trusted contacts expire upon arrival.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Lock className="h-3.5 w-3.5 text-[var(--teal,#16756c)] shrink-0 mt-0.5" />
                    <span>
                      Location points are never sold or shared with third-party
                      ad brokers.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          7. EMERGENCY & 112 ASSISTANCE
      ===================================================== */}
      <section
        id="emergency"
        className="border-t border-[var(--line,#d8ddd7)] bg-[var(--card,#fbfbf9)] py-20"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--coral,#b6433d)]">
              Emergency Assistance & Official 112
            </span>
            <h2 className="mt-2 font-serif text-3xl font-bold text-[var(--ink,#14231d)] sm:text-4xl">
              Rapid civic handoff when you need help.
            </h2>
            <p className="mt-3 text-base text-[var(--muted,#53615a)]">
              SaferPath does not pretend to dispatch private security. In urgent
              situations, our platform provides instant, one-tap access to
              official national emergency response (112) and verified nearby
              civic facilities.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-6">
              <PhoneCall className="h-6 w-6 text-[var(--coral,#b6433d)]" />
              <h3 className="mt-4 font-serif text-lg font-bold text-[var(--ink,#14231d)]">
                Direct 112 Emergency Call
              </h3>
              <p className="mt-2 text-xs text-[var(--muted,#53615a)] leading-relaxed">
                Connects directly to the National Emergency Response Support
                System (ERSS) in India with one tap.
              </p>
              <a
                href="tel:112"
                className="mt-4 inline-flex items-center gap-1.5 font-bold text-xs text-[var(--coral,#b6433d)] hover:underline"
              >
                Call 112 Emergency →
              </a>
            </div>

            <div className="rounded-xl border border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] p-6">
              <MapPin className="h-6 w-6 text-[var(--teal,#16756c)]" />
              <h3 className="mt-4 font-serif text-lg font-bold text-[var(--ink,#14231d)]">
                Verified Police & Transit Booths
              </h3>
              <p className="mt-2 text-xs text-[var(--muted,#53615a)] leading-relaxed">
                Coordinates and phone contacts for the nearest staffed railway
                protection post or local police station.
              </p>
              <Link
                to="/login"
                className="mt-4 inline-flex items-center gap-1.5 font-bold text-xs text-[var(--teal,#16756c)] hover:underline"
              >
                Explore nearby help points →
              </Link>
            </div>

            <div className="rounded-xl border border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] p-6">
              <Clock className="h-6 w-6 text-[var(--teal,#16756c)]" />
              <h3 className="mt-4 font-serif text-lg font-bold text-[var(--ink,#14231d)]">
                24/7 Chemist & Medical Points
              </h3>
              <p className="mt-2 text-xs text-[var(--muted,#53615a)] leading-relaxed">
                Locations of pharmacies verified to maintain round-the-clock
                operating hours and lighting.
              </p>
              <Link
                to="/login"
                className="mt-4 inline-flex items-center gap-1.5 font-bold text-xs text-[var(--teal,#16756c)] hover:underline"
              >
                View facility directory →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          8. FINAL CALL TO ACTION
      ===================================================== */}
      <section className="border-t border-[var(--line,#d8ddd7)] bg-[var(--teal,#16756c)] py-16 text-white text-center">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <h2 className="font-serif text-3xl font-bold sm:text-4xl">
            Choose your route with more context tonight.
          </h2>
          <p className="mt-4 text-sm text-[var(--teal-soft,#dcefe9)] max-w-xl mx-auto">
            Experience civic-tech mobility built on municipal evidence, privacy
            by design, and real urban context.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3.5 text-sm font-bold text-[var(--teal,#16756c)] shadow-sm hover:bg-[#f0f2ed] transition"
            >
              Get started with SaferPath
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          9. FOOTER
      ===================================================== */}
      <footer className="border-t border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] py-12 text-xs text-[var(--muted,#53615a)]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <SaferPathLogo size={24} variant="full" />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted,#53615a)]">
                A civic-tech mobility platform providing temporal context and
                verified urban observations.
              </p>
              <p className="mt-2 text-[11px] text-[var(--muted,#65746d)]">
                Pilot Corridor: Shivaji Park / Bandra West, Mumbai.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-[var(--ink,#14231d)] uppercase tracking-wider text-[11px]">
                Product
              </h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <a href="#how-it-works" className="hover:underline">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#time-context" className="hover:underline">
                    Time Changes Context
                  </a>
                </li>
                <li>
                  <a href="#evidence" className="hover:underline">
                    Evidence & Uncertainty
                  </a>
                </li>
                <li>
                  <a href="#active-trip" className="hover:underline">
                    Active Trip Engine
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-[var(--ink,#14231d)] uppercase tracking-wider text-[11px]">
                Ethics & Safety
              </h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <a href="#privacy" className="hover:underline">
                    Zero-Surveillance Privacy
                  </a>
                </li>
                <li>
                  <a href="#emergency" className="hover:underline">
                    Emergency 112 Handoff
                  </a>
                </li>
                <li>
                  <Link to="/login" className="hover:underline">
                    Report Community Observations
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-[var(--ink,#14231d)] uppercase tracking-wider text-[11px]">
                Account & Access
              </h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link to="/login" className="hover:underline">
                    Sign In / Register
                  </Link>
                </li>
                <li>
                  <span className="text-[var(--muted,#8b9c94)]">
                    Open Standards / PostGIS
                  </span>
                </li>
                <li>
                  <span className="text-[var(--muted,#8b9c94)]">WCAG 2.1 AA Compliant</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-[var(--line,#e2e6e1)] pt-6 flex flex-wrap items-center justify-between gap-4 text-[11px]">
            <p>
              © {new Date().getFullYear()} SaferPath Mobility Initiative. All
              rights reserved.
            </p>
            <p className="text-[var(--muted,#65746d)]">
              SaferPath does not guarantee personal safety and is not a
              substitute for emergency response services.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
