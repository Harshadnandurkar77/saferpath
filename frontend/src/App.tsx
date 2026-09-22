import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { useState } from "react";
import {
  HelpNearbyWorkspace,
  ProductShell,
  ReportsWorkspace,
  TripsWorkspace,
} from "./components/product/ProductSurface";
import { HomeView } from "./components/app/HomeView";
import { LandingPage } from "./pages/LandingPage";
import { OnboardingFlow } from "./pages/OnboardingFlow";
import { PrivacyPage, ProfilePage } from "./components/product/IdentityPages";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SaferPathLogo } from "./components/brand/SaferPathLogo";
import { ThemeToggle } from "./components/brand/ThemeToggle";
import { requestCode } from "./api/identity";

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
      setMessage(
        e instanceof Error ? e.message : "The code could not be verified.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--paper,#f7f6f1)] p-5">
      <section className="w-full max-w-md rounded-2xl border border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="text-xs font-semibold text-[var(--muted,#53615a)] hover:text-[var(--ink,#14231d)] transition"
          >
            ← Back to SaferPath
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SaferPathLogo size={28} variant="mark" />
          </div>
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[.14em] text-[var(--teal,#16756c)]">
          Email verification
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-[var(--ink,#14231d)]">
          {sent ? "Enter your code" : "Continue with email"}
        </h1>
        <p className="mt-2 text-xs text-[var(--muted,#62706a)]">
          {sent
            ? `Enter the six-digit code sent to ${email}.`
            : "Password-free authentication for all travellers. No tracking."}
        </p>

        {message && (
          <p
            role="alert"
            className="mt-4 border-l-2 border-[var(--coral,#b6433d)] bg-red-50 dark:bg-red-950/40 p-3 text-xs text-[var(--coral,#b6433d)]"
          >
            {message}
          </p>
        )}

        {!sent ? (
          <div className="mt-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted,#62706a)]">
              Email Address
            </label>
            <input
              className="mt-2 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-3 text-sm text-[var(--ink,#14231d)] outline-none focus:border-[var(--teal,#16756c)]"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <button
              disabled={
                busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
              }
              onClick={() => void send()}
              className="mt-5 w-full rounded-md bg-[var(--teal,#16756c)] p-3 text-sm font-semibold text-white transition hover:bg-[#075b53] disabled:opacity-40"
            >
              {busy ? "Requesting code..." : "Request code"}
            </button>
            <p className="mt-4 text-center text-[11px] text-[var(--muted,#62706a)]">
              Check your backend terminal for the development OTP.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted,#62706a)]">
              Six-digit verification code
            </label>
            <input
              className="mt-2 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-3 text-center text-xl font-bold tracking-[.45em] text-[var(--ink,#14231d)] outline-none focus:border-[var(--teal,#16756c)]"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              autoFocus
            />
            <button
              disabled={busy || code.length !== 6}
              onClick={() => void submit()}
              className="mt-5 w-full rounded-md bg-[var(--teal,#16756c)] p-3 text-sm font-semibold text-white transition hover:bg-[#075b53] disabled:opacity-40"
            >
              {busy ? "Verifying..." : "Verify and continue"}
            </button>
            <div className="mt-4 flex items-center justify-between text-xs">
              <button
                disabled={busy}
                onClick={() => void send()}
                className="text-[var(--teal,#16756c)] hover:underline"
              >
                Resend code
              </button>
              <button
                onClick={() => {
                  setSent(false);
                  setCode("");
                }}
                className="text-[var(--muted,#62706a)] hover:underline"
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

function Guard({ children }: { children: React.ReactNode }) {
  const { phase, onboarding } = useAuth();

  if (phase === "initializing") {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--paper,#f7f6f1)]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--teal,#16756c)] border-t-transparent"></div>
          <p className="mt-3 font-serif text-sm font-medium text-[var(--muted,#53615a)]">
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
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Experience */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<OnboardingFlow />} />

            {/* Authenticated Experience: Unified Home */}
            <Route
              path="/app"
              element={
                <Guard>
                  <ProductShell>
                    <HomeView />
                  </ProductShell>
                </Guard>
              }
            />
            <Route path="/home" element={<Navigate to="/app" replace />} />
            <Route path="/plan" element={<Navigate to="/app" replace />} />

            {/* Other Product Surfaces */}
            <Route
              path="/trips"
              element={
                <Guard>
                  <ProductShell>
                    <div className="p-6 md:p-8">
                      <TripsWorkspace />
                    </div>
                  </ProductShell>
                </Guard>
              }
            />
            <Route
              path="/reports"
              element={
                <Guard>
                  <ProductShell>
                    <div className="p-6 md:p-8">
                      <ReportsWorkspace />
                    </div>
                  </ProductShell>
                </Guard>
              }
            />
            <Route
              path="/help"
              element={
                <Guard>
                  <ProductShell>
                    <div className="p-6 md:p-8">
                      <HelpNearbyWorkspace />
                    </div>
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
    </ThemeProvider>
  );
}
