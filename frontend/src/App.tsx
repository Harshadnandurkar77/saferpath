import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  HelpNearbyWorkspace,
  ProductShell,
  ReportsWorkspace,
  RouteWorkspace,
  TripsWorkspace,
} from "./components/product/ProductSurface";
import { PrivacyPage, ProfilePage } from "./components/product/IdentityPages";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { requestCode, updateProfile } from "./api/identity";
import { Shield } from "lucide-react";
import type { TravellerType } from "./api/types";

function Landing() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6f1] p-6">
      <section className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#16756c]">
          Context-aware route planning
        </p>
        <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight text-[#14231d] sm:text-6xl sm:leading-none">
          Choose your route with more context.
        </h1>
        <p className="mt-6 text-lg text-[#53615a]">
          Evidence, freshness and uncertainty — never a promise of safety.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            className="inline-block bg-[#16756c] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#075b53]"
            to="/login"
          >
            Continue with email
          </Link>
          <span className="text-xs text-[#62706a]">
            Passwordless OTP authentication · No tracking
          </span>
        </div>
      </section>
    </main>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { verify } = useAuth();
  const nav = useNavigate();

  const send = async () => {
    setBusy(true);
    setMessage("");
    try {
      await requestCode(email.trim());
      setSent(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to request a code.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setMessage("");
    try {
      await verify(email.trim(), code.trim());
      nav("/onboarding");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The code could not be verified.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6f1] p-5">
      <section className="w-full max-w-md border border-[#d8ddd7] bg-[#fffefb] p-7 shadow-sm">
        <Link to="/" className="text-xs font-semibold text-[#53615a] hover:text-[#14231d]">
          ← Back to SaferPath
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[.14em] text-[#16756c]">
          Email verification
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#14231d]">
          {sent ? "Enter your code" : "Continue with email"}
        </h1>
        <p className="mt-3 text-sm text-[#62706a]">
          {sent
            ? `Enter the six-digit code sent to ${email}.`
            : "New and returning travellers follow the same password-free authentication flow."}
        </p>

        {message && (
          <p role="alert" className="mt-4 border-l-2 border-[#b6433d] bg-[#fff0ed] p-3 text-xs text-[#b6433d]">
            {message}
          </p>
        )}

        {!sent ? (
          <div className="mt-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]">
              Email Address
            </label>
            <input
              className="mt-2 w-full border border-[#aab7af] p-3 text-sm outline-none focus:border-[#16756c]"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <button
              disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
              onClick={() => void send()}
              className="mt-5 w-full bg-[#16756c] p-3 text-sm font-semibold text-white transition hover:bg-[#075b53] disabled:opacity-40"
            >
              {busy ? "Requesting code..." : "Request code"}
            </button>
            <p className="mt-4 text-center text-[11px] text-[#62706a]">
              In development mode, verify with any 6-digit code or check backend logs.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]">
              Six-digit verification code
            </label>
            <input
              className="mt-2 w-full border border-[#aab7af] p-3 text-center text-xl font-bold tracking-[.45em] outline-none focus:border-[#16756c]"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
            />
            <button
              disabled={busy || code.length !== 6}
              onClick={() => void submit()}
              className="mt-5 w-full bg-[#16756c] p-3 text-sm font-semibold text-white transition hover:bg-[#075b53] disabled:opacity-40"
            >
              {busy ? "Verifying..." : "Verify and continue"}
            </button>
            <div className="mt-4 flex items-center justify-between text-xs">
              <button
                disabled={busy}
                onClick={() => void send()}
                className="text-[#16756c] hover:underline"
              >
                Resend code
              </button>
              <button
                onClick={() => {
                  setSent(false);
                  setCode("");
                }}
                className="text-[#62706a] hover:underline"
              >
                Change email
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Onboarding() {
  const [choice, setChoice] = useState<TravellerType>("SKIP");
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("English");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { refresh, onboarding } = useAuth();
  const nav = useNavigate();

  const save = async () => {
    setBusy(true);
    try {
      await updateProfile({
        traveller_type: choice,
        display_name: displayName.trim() || null,
        language,
      });
      await refresh();
      nav("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your profile could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  if (onboarding?.profile_complete) {
    return <Navigate to="/home" replace />;
  }

  const travellerTypes: [TravellerType, string, string][] = [
    ["STUDENT", "Student", "Frequent transit and walking near campuses."],
    ["EMPLOYEE", "Employee", "Regular commute routes and business districts."],
    ["DAILY_USE", "Daily-use traveller", "Neighborhood errands, leisure, and daily trips."],
    ["SKIP", "Skip for now", "General route planning without personalization."],
  ];

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6f1] p-5">
      <section className="w-full max-w-2xl border border-[#d8ddd7] bg-[#fffefb] p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16756c]">
          Welcome to SaferPath · Profile Setup
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#14231d]">
          What brings you here?
        </h1>
        <p className="mt-2 text-sm text-[#62706a]">
          All choices are optional and backed by your private SaferPath profile. You can change them anytime.
        </p>

        {error && (
          <p role="alert" className="mt-4 border-l-2 border-[#b6433d] bg-[#fff0ed] p-3 text-xs text-[#b6433d]">
            {error}
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {travellerTypes.map(([key, label, desc]) => (
            <button
              key={key}
              type="button"
              onClick={() => setChoice(key)}
              className={`border p-4 text-left transition ${
                choice === key
                  ? "border-[#16756c] bg-[#dcefe9] shadow-sm"
                  : "border-[#d8ddd7] bg-[#fffefb] hover:bg-[#f0f2ed]"
              }`}
            >
              <span className="block text-sm font-bold text-[#14231d]">{label}</span>
              <span className="mt-1 block text-xs text-[#62706a]">{desc}</span>
            </button>
          ))}
        </div>

        {/* Optional Display Name & Language */}
        <div className="mt-6 border-t border-[#d8ddd7] pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                Display Name (Optional)
              </label>
              <input
                type="text"
                placeholder="Pseudonym or first name"
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1.5 w-full border border-[#aab7af] bg-white p-2.5 text-xs outline-none focus:border-[#16756c]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                Language Preference
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1.5 w-full border border-[#aab7af] bg-white p-2.5 text-xs outline-none"
              >
                <option value="English">English</option>
                <option value="Hindi">हिन्दी (Hindi)</option>
                <option value="Marathi">मराठी (Marathi)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-[#d8ddd7] pt-5">
          <div className="flex items-center gap-2 text-xs text-[#62706a]">
            <Shield className="h-4 w-4 text-[#16756c]" />
            No continuous location collected
          </div>
          <button
            disabled={busy}
            onClick={() => void save()}
            className="bg-[#16756c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#075b53] disabled:opacity-50"
          >
            {busy ? "Saving to server..." : "Continue to Route Planning"}
          </button>
        </div>
      </section>
    </main>
  );
}

function Guard({ children }: { children: React.ReactNode }) {
  const { phase, onboarding } = useAuth();

  if (phase === "initializing") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f6f1]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#16756c] border-t-transparent"></div>
          <p className="mt-3 font-serif text-sm font-medium text-[#53615a]">
            Restoring your verified session...
          </p>
        </div>
      </main>
    );
  }

  if (phase !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  if (!onboarding?.profile_complete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route
            path="/home"
            element={
              <Guard>
                <ProductShell>
                  <RouteWorkspace />
                </ProductShell>
              </Guard>
            }
          />
          <Route
            path="/plan"
            element={
              <Guard>
                <ProductShell>
                  <RouteWorkspace />
                </ProductShell>
              </Guard>
            }
          />
          <Route
            path="/trips"
            element={
              <Guard>
                <ProductShell>
                  <TripsWorkspace />
                </ProductShell>
              </Guard>
            }
          />
          <Route
            path="/reports"
            element={
              <Guard>
                <ProductShell>
                  <ReportsWorkspace />
                </ProductShell>
              </Guard>
            }
          />
          <Route
            path="/help"
            element={
              <Guard>
                <ProductShell>
                  <HelpNearbyWorkspace />
                </ProductShell>
              </Guard>
            }
          />
          <Route
            path="/profile"
            element={
              <Guard>
                <ProfilePage />
              </Guard>
            }
          />
          <Route
            path="/privacy"
            element={
              <Guard>
                <PrivacyPage />
              </Guard>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
