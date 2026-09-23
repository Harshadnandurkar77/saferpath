import type { ReactNode } from "react";
import {
  Shield,
  Home,
  Navigation,
  FileText,
  LifeBuoy,
  User,
  LogOut,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { SaferPathLogo } from "../brand/SaferPathLogo";
import { ThemeToggle } from "../brand/ThemeToggle";
import { GlobalEmergencyAction } from "./GlobalEmergencyAction";

export { RouteWorkspace } from "./RouteWorkspace";
export { ReportsWorkspace } from "./ReportsWorkspace";
export { HelpNearbyWorkspace } from "./HelpNearbyWorkspace";
export { TripsWorkspace } from "./TripsWorkspace";

const desktopNavLinks = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Trips", href: "/trips", icon: Navigation },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Help Nearby", href: "/help", icon: LifeBuoy },
  { label: "Privacy", href: "/privacy", icon: Shield },
  { label: "Profile", href: "/profile", icon: User },
] as const;

const mobileBottomTabs = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Trips", href: "/trips", icon: Navigation },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Help", href: "/help", icon: LifeBuoy },
  { label: "Profile", href: "/profile", icon: User },
] as const;

export function ProductShell({ children }: { children: ReactNode }) {
  const path = useLocation().pathname;
  const navigate = useNavigate();
  const { account, logout } = useAuth();
  const displayName = account?.display_name || "My Account";

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch {
      // Ignore
    }
  };

  return (
    <div className="min-h-screen bg-[var(--paper,#f7f6f1)] text-[var(--ink,#14231d)]">
      {/* Desktop Sidebar Navigation */}
      <aside className="fixed inset-y-0 hidden w-64 border-r border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] p-6 md:flex md:flex-col md:justify-between">
        <div>
          <Link
            to="/app"
            className="mb-8 flex items-center gap-2.5 font-bold tracking-tight"
          >
            <SaferPathLogo size={30} variant="full" />
          </Link>

          <nav className="space-y-1" aria-label="Primary navigation">
            {desktopNavLinks.map(({ label, href, icon: Icon }) => {
              const isActive =
                path === href || (href === "/app" && path === "/home");
              return (
                <Link
                  key={href}
                  to={href}
                  className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-xs font-medium transition ${
                    isActive
                      ? "bg-[var(--teal-soft,#dcefe9)] font-bold text-[var(--teal,#075b53)]"
                      : "text-[var(--muted,#53615a)] hover:bg-[var(--hover,#f0f2ed)] hover:text-[var(--ink,#14231d)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          <div className="border-t border-[var(--line,#d8ddd7)] pt-4 pb-2">
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2 text-xs font-medium text-[var(--muted,#53615a)] hover:bg-[var(--hover,#f0f2ed)] hover:text-[var(--coral,#b6433d)] transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>

          <div className="rounded-lg border border-[var(--line,#d8ddd7)] bg-[var(--card,#fbfbf9)] p-3 text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--teal,#16756c)]">
              <Shield className="h-3.5 w-3.5" />
              <span>Zero-Surveillance Mobility</span>
            </div>
            <p className="mt-1 leading-4 text-[var(--muted,#62706a)]">
              Contextual evidence, never guarantees. Your route choices remain
              private.
            </p>
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)]/95 px-4 sm:px-6 backdrop-blur-xs md:ml-64">
        <Link to="/app" className="md:hidden">
          <SaferPathLogo size={24} variant="full" />
        </Link>
        <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--muted,#53615a)]">
          <span>Contextual navigation for urban travellers</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            to="/profile"
            className="text-xs font-semibold text-[var(--muted,#53615a)] hover:text-[var(--ink,#14231d)] transition"
          >
            {displayName}
          </Link>
          <Link
            to="/privacy"
            className="hidden sm:inline-block rounded border border-[var(--line,#bdc9c0)] px-2.5 py-1 text-[11px] text-[var(--muted,#53615a)] hover:bg-[var(--hover,#f0f2ed)] transition"
          >
            Privacy
          </Link>
        </div>
      </header>

      {/* Main Content Area (extra bottom padding on mobile for bottom tabs) */}
      <main className="md:ml-64 pb-16 md:pb-0">{children}</main>
      <GlobalEmergencyAction />

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 flex h-14 border-t border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)]/95 backdrop-blur-md md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="grid w-full grid-cols-5">
          {mobileBottomTabs.map(({ label, href, icon: Icon }) => {
            const isActive =
              path === href || (href === "/app" && path === "/home");
            return (
              <Link
                key={href}
                to={href}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${
                  isActive
                    ? "text-[var(--teal,#16756c)]"
                    : "text-[var(--muted,#62706a)] hover:text-[var(--ink,#14231d)]"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "stroke-[2.5]" : ""}`} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
