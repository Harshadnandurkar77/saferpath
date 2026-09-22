import { useEffect, useState } from "react";
import { ProductShell } from "./ProductSurface";
import { consents, createConsent, profile, updateProfile, withdrawConsent } from "../../api/identity";
import type { Consent, ConsentPurpose, TravellerType } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle2, Globe, LogOut, Shield, User } from "lucide-react";

const purposeLabels: Record<string, string> = {
  ROUTE_PLANNING_LOCATION: "Route-planning location (ephemeral query)",
  ACTIVE_TRIP_LOCATION: "Active-trip location (sharing during trip only)",
  TRUSTED_CONTACT_SHARING: "Trusted contact status sharing",
  NOTIFICATIONS: "Service notifications & check-in alerts",
  PUBLIC_REPORT_PUBLICATION: "Public report publication",
  PRIVATE_EVIDENCE_RETENTION: "Private evidence retention",
  EMERGENCY_HANDOFF: "Emergency official handoff integration",
  PERSONALISATION: "Optional route personalisation",
};

export function ProfilePage() {
  const { logout, refresh } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [travellerType, setTravellerType] = useState<TravellerType>("SKIP");
  const [language, setLanguage] = useState("English");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void profile()
      .then((p) => {
        setDisplayName(p.display_name || "");
        setTravellerType(p.traveller_type || "SKIP");
        setLanguage(p.language || "English");
        const access = p.accessibility_preferences || {};
        setReducedMotion(Boolean(access.reduced_motion));
        setHighContrast(Boolean(access.high_contrast));
        setIsLoading(false);
      })
      .catch(() => {
        setErrorMessage("We could not load your profile from the server. Please try again.");
        setIsLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await updateProfile({
        display_name: displayName.trim() || null,
        traveller_type: travellerType,
        language,
        accessibility_preferences: {
          reduced_motion: reducedMotion,
          high_contrast: highContrast,
        },
      });
      await refresh();
      setStatusMessage("Profile updated successfully on the server.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      await logout();
    }
  };

  return (
    <ProductShell>
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16756c]">
          Account & Preferences
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-[#14231d]">
          Profile & Settings
        </h1>
        <p className="mt-2 text-xs text-[#53615a]">
          Your profile is backed directly by your SaferPath account. All fields are optional.
        </p>

        {isLoading ? (
          <div className="mt-8 border border-dashed border-[#d8ddd7] p-8 text-center text-xs text-[#62706a]">
            Loading profile from server...
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-8 space-y-6">
            {statusMessage && (
              <div role="status" className="flex items-center gap-2 border border-[#16756c] bg-[#dcefe9] p-3 text-xs font-medium text-[#075b53]">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16756c]" />
                {statusMessage}
              </div>
            )}

            {errorMessage && (
              <div role="alert" className="border-l-4 border-[#b6433d] bg-[#fde8e7] p-3 text-xs font-medium text-[#b6433d]">
                {errorMessage}
              </div>
            )}

            {/* Display Name Section */}
            <section className="border border-[#d8ddd7] bg-[#fffefb] p-6 shadow-sm">
              <div className="flex items-center gap-2 font-serif text-base font-semibold text-[#14231d]">
                <User className="h-4 w-4 text-[#16756c]" />
                Identity & Display
              </div>
              <p className="mt-1 text-xs text-[#62706a]">
                Choose how you appear or use a pseudonym. Real name is never required.
              </p>

              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                  Display Name or Pseudonym
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Daily commuter"
                  className="mt-1.5 w-full border border-[#aab7af] bg-white p-3 text-sm outline-none focus:border-[#16756c]"
                />
              </div>

              {/* Traveller Type */}
              <div className="mt-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                  Traveller Type
                </label>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  {[
                    ["STUDENT", "Student"],
                    ["EMPLOYEE", "Employee"],
                    ["DAILY_USE", "Daily-use"],
                    ["SKIP", "General / Skip"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTravellerType(key as TravellerType)}
                      className={`border p-3 text-center text-xs transition ${
                        travellerType === key
                          ? "border-[#16756c] bg-[#dcefe9] font-semibold text-[#075b53]"
                          : "border-[#d8ddd7] bg-[#fffefb] text-[#53615a] hover:bg-[#f0f2ed]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Language & Accessibility */}
            <section className="border border-[#d8ddd7] bg-[#fffefb] p-6 shadow-sm">
              <div className="flex items-center gap-2 font-serif text-base font-semibold text-[#14231d]">
                <Globe className="h-4 w-4 text-[#16756c]" />
                Language & Accessibility
              </div>

              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                  Interface Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-1.5 w-full border border-[#aab7af] bg-white p-3 text-sm outline-none"
                >
                  <option value="English">English</option>
                  <option value="Hindi">हिन्दी (Hindi)</option>
                  <option value="Marathi">मराठी (Marathi)</option>
                </select>
              </div>

              <div className="mt-5 space-y-3">
                <label className="flex items-center gap-3 text-xs font-medium text-[#14231d]">
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => setReducedMotion(e.target.checked)}
                    className="text-[#16756c]"
                  />
                  <span>Reduced Motion (Minimize animations and transitions)</span>
                </label>
                <label className="flex items-center gap-3 text-xs font-medium text-[#14231d]">
                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={(e) => setHighContrast(e.target.checked)}
                    className="text-[#16756c]"
                  />
                  <span>High Contrast (Enhanced borders and readable tones)</span>
                </label>
              </div>
            </section>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#d8ddd7] pt-5">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-[#16756c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#075b53] disabled:opacity-50"
              >
                {isSaving ? "Saving profile..." : "Save changes to server"}
              </button>

              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex items-center gap-1.5 border border-[#b6433d] px-4 py-2 text-xs font-semibold text-[#b6433d] hover:bg-[#fde8e7]"
              >
                <LogOut className="h-4 w-4" />
                Sign out of session
              </button>
            </div>
          </form>
        )}
      </div>
    </ProductShell>
  );
}

export function PrivacyPage() {
  const [items, setItems] = useState<Consent[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadConsentsList = async () => {
    setIsLoading(true);
    try {
      const res = await consents();
      setItems(res);
      setErrorMessage(null);
    } catch {
      setErrorMessage("Could not load consent records from server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadConsentsList();
  }, []);

  const handleToggle = async (purpose: ConsentPurpose | string) => {
    const active = items.find((x) => x.purpose === purpose && x.effective);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      if (active) {
        const label = purposeLabels[purpose] || purpose;
        if (!window.confirm(`Withdraw consent for: ${label}?`)) return;
        await withdrawConsent(active.id);
        setStatusMessage("Consent withdrawn successfully.");
      } else {
        await createConsent(purpose, true);
        setStatusMessage("Consent granted and recorded on the server.");
      }
      await loadConsentsList();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update consent.");
    }
  };

  const PRIMARY_PURPOSES: ConsentPurpose[] = [
    "ROUTE_PLANNING_LOCATION",
    "ACTIVE_TRIP_LOCATION",
    "TRUSTED_CONTACT_SHARING",
    "NOTIFICATIONS",
    "PUBLIC_REPORT_PUBLICATION",
    "PRIVATE_EVIDENCE_RETENTION",
    "EMERGENCY_HANDOFF",
    "PERSONALISATION",
  ];

  return (
    <ProductShell>
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16756c]">
          Privacy Architecture & Consent Management
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-[#14231d]">
          Privacy Center
        </h1>
        <p className="mt-2 text-xs leading-5 text-[#53615a]">
          Every consent is granular, explicit, and revocable at any time. Route-planning queries do not enable continuous active-trip tracking.
        </p>

        {statusMessage && (
          <div role="status" className="mt-6 flex items-center gap-2 border border-[#16756c] bg-[#dcefe9] p-3 text-xs font-medium text-[#075b53]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16756c]" />
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="mt-6 border-l-4 border-[#b6433d] bg-[#fde8e7] p-3 text-xs font-medium text-[#b6433d]">
            {errorMessage}
          </div>
        )}

        {/* Guarantees Box */}
        <div className="mt-6 border border-[#d8ddd7] bg-[#fffefb] p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#16756c]" />
            <div className="text-xs leading-5 text-[#53615a]">
              <p className="font-semibold text-[#14231d]">Zero-Surveillance Architecture</p>
              <ul className="mt-1 list-disc pl-4 space-y-1">
                <li>No background geolocation when the app is closed.</li>
                <li>No advertising tracking, commercial resale, or broker sharing.</li>
                <li>Trip data retention expires after 7 days automatically.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Consent Records List */}
        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#62706a]">
            Configurable Permissions & Legal Consents ({PRIMARY_PURPOSES.length})
          </h2>

          {isLoading ? (
            <div className="mt-3 border border-dashed border-[#d8ddd7] p-6 text-center text-xs text-[#62706a]">
              Loading consent records from server...
            </div>
          ) : (
            <div className="mt-3 divide-y border border-[#d8ddd7] bg-[#fffefb] shadow-sm">
              {PRIMARY_PURPOSES.map((purpose) => {
                const active = items.some((x) => x.purpose === purpose && x.effective);
                const label = purposeLabels[purpose] || purpose;

                return (
                  <div key={purpose} className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="max-w-md">
                      <span className="block text-sm font-semibold text-[#14231d]">{label}</span>
                      <span className="mt-0.5 block text-xs text-[#62706a]">
                        {active
                          ? "Active consent recorded on server. You may withdraw at any time."
                          : "Not active. Functionality requiring this permission remains disabled."}
                      </span>
                    </div>

                    <button
                      onClick={() => void handleToggle(purpose)}
                      className={`border px-4 py-2 text-xs font-semibold transition ${
                        active
                          ? "border-[#b6433d] bg-transparent text-[#b6433d] hover:bg-[#fde8e7]"
                          : "border-[#16756c] bg-[#16756c] text-white hover:bg-[#075b53]"
                      }`}
                    >
                      {active ? "Withdraw consent" : "Allow permission"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProductShell>
  );
}
