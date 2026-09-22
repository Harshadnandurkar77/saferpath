import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import {
  Shield,
  ArrowRight,
  ArrowLeft,
  Lock,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { updateProfile } from "../api/identity";
import { createTrustedContact } from "../api/trustedContacts";
import { SaferPathLogo } from "../components/brand/SaferPathLogo";
import { ThemeToggle } from "../components/brand/ThemeToggle";
import type { TravellerType } from "../api/types";

interface ContactItem {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

export function OnboardingFlow() {
  const { refresh, onboarding, account } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Identity & Preferences
  const [displayName, setDisplayName] = useState(account?.display_name || "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [language, setLanguage] = useState("English");

  // Step 2: Traveller Type
  const [travellerType, setTravellerType] =
    useState<TravellerType>("DAILY_USE");

  // Step 3: Multiple Trusted Contacts
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [currentName, setCurrentName] = useState("");
  const [currentRelationship, setCurrentRelationship] = useState("Family");
  const [currentPhone, setCurrentPhone] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");

  // Step 4: Daily Routine
  const [morningOrigin, setMorningOrigin] = useState("Home");
  const [morningDestination, setMorningDestination] =
    useState("Office / College");
  const [morningTime, setMorningTime] = useState("08:30");
  const [eveningOrigin, setEveningOrigin] = useState("Office / College");
  const [eveningDestination, setEveningDestination] = useState("Home");
  const [eveningTime, setEveningTime] = useState("18:30");
  const [includeRoutine, setIncludeRoutine] = useState(true);

  // Step 5: Geolocation state
  const [geoPermissionGranted, setGeoPermissionGranted] = useState<
    boolean | null
  >(null);

  if (onboarding?.profile_complete) {
    return <Navigate to="/app" replace />;
  }

  const travellerTypes: { key: TravellerType; title: string; desc: string }[] =
    [
      {
        key: "STUDENT",
        title: "Student",
        desc: "Frequent transit and walking near campuses and student housing.",
      },
      {
        key: "EMPLOYEE",
        title: "Commuter / Employee",
        desc: "Regular rush hour commute between business districts and residential hubs.",
      },
      {
        key: "DAILY_USE",
        title: "Daily-use Traveller",
        desc: "Neighborhood errands, evening leisure, and everyday walking trips.",
      },
      {
        key: "SKIP",
        title: "General Traveller",
        desc: "Route context without specific traveller profiling.",
      },
    ];

  const handleAddContact = () => {
    if (!currentName.trim()) {
      setError("Please provide a name for the trusted contact.");
      return;
    }
    if (!currentPhone.trim() && !currentEmail.trim()) {
      setError("Please provide either a phone number or email address.");
      return;
    }

    setContacts((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: currentName.trim(),
        relationship: currentRelationship,
        phone: currentPhone.trim(),
        email: currentEmail.trim(),
      },
    ]);

    setCurrentName("");
    setCurrentPhone("");
    setCurrentEmail("");
    setError(null);
  };

  const handleRemoveContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleRequestGeo = () => {
    if (!navigator.geolocation) {
      setGeoPermissionGranted(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setGeoPermissionGranted(true),
      () => setGeoPermissionGranted(false),
    );
  };

  const handleComplete = async () => {
    setBusy(true);
    setError(null);
    try {
      const allContacts = [...contacts];
      if (currentName.trim() && (currentPhone.trim() || currentEmail.trim())) {
        allContacts.push({
          id: "draft",
          name: currentName.trim(),
          relationship: currentRelationship,
          phone: currentPhone.trim(),
          email: currentEmail.trim(),
        });
      }

      for (const c of allContacts) {
        try {
          await createTrustedContact({
            display_name: c.name,
            relationship_label: c.relationship,
            contact_reference: c.phone || c.email,
          });
        } catch {
          // Non-blocking
        }
      }

      const profileData: Record<string, unknown> = {
        phone: phoneNumber.trim() || undefined,
      };

      if (includeRoutine && morningOrigin.trim()) {
        profileData.routines = {
          morning: {
            origin: morningOrigin.trim(),
            destination: morningDestination.trim(),
            preferred_time: morningTime,
          },
          evening: {
            origin: eveningOrigin.trim(),
            destination: eveningDestination.trim(),
            preferred_time: eveningTime,
          },
        };
      }

      await updateProfile({
        traveller_type: travellerType,
        display_name: displayName.trim() || null,
        language,
        profile_data: profileData,
      });

      await refresh();
      navigate("/app");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save profile settings.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--paper,#f7f6f1)] py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl">
        {/* Progress Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SaferPathLogo size={28} variant="full" />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="text-xs font-semibold text-[var(--muted,#53615a)]">
              Step {step} of 6
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line,#e2e6e1)]">
          <div
            className="h-full bg-[var(--teal,#16756c)] transition-all duration-300"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>

        {/* Error notice */}
        {error && (
          <div className="mb-6 rounded-lg border-l-4 border-[var(--coral,#b6433d)] bg-red-50 dark:bg-red-950/40 p-4 text-xs text-[var(--coral,#b6433d)]">
            {error}
          </div>
        )}

        {/* Main Card */}
        <section className="rounded-xl border border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] p-6 shadow-sm sm:p-8">
          {/* =====================================================
              STEP 1: IDENTITY & PREFERENCES
          ===================================================== */}
          {step === 1 && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal,#16756c)]">
                Profile Setup
              </span>
              <h1 className="mt-1 font-serif text-2xl font-bold text-[var(--ink,#14231d)] sm:text-3xl">
                Welcome to SaferPath
              </h1>
              <p className="mt-2 text-sm text-[var(--muted,#53615a)]">
                Personalize your experience. All information is private to your
                account and never public.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted,#53615a)]">
                    Display Name or Pseudonym
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Maya or Commuter"
                    className="mt-1.5 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-3 text-sm text-[var(--ink,#14231d)] outline-none focus:border-[var(--teal,#16756c)]"
                  />
                  <p className="mt-1 text-[11px] text-[var(--muted,#65746d)]">
                    Used for friendly greetings. You can use your first name or
                    any pseudonym.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted,#53615a)]">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+91 98200 00000"
                    className="mt-1.5 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-3 text-sm text-[var(--ink,#14231d)] outline-none focus:border-[var(--teal,#16756c)]"
                  />
                  <p className="mt-1 text-[11px] text-[var(--muted,#65746d)]">
                    Only used if you trigger an official 112 emergency handoff
                    or SMS dispatch.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted,#53615a)]">
                    Language Preference
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-3 text-sm text-[var(--ink,#14231d)] outline-none focus:border-[var(--teal,#16756c)]"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">हिन्दी (Hindi)</option>
                    <option value="Marathi">मराठी (Marathi)</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end border-t border-[var(--line,#e2e6e1)] pt-5">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--teal,#16756c)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#075b53] transition"
                >
                  Next: Traveller Type
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* =====================================================
              STEP 2: TRAVELLER TYPE
          ===================================================== */}
          {step === 2 && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal,#16756c)]">
                Mobility Profile
              </span>
              <h1 className="mt-1 font-serif text-2xl font-bold text-[var(--ink,#14231d)] sm:text-3xl">
                How do you usually travel?
              </h1>
              <p className="mt-2 text-sm text-[var(--muted,#53615a)]">
                This helps tune corridor highlights to the pedestrian and
                transit environments you use most.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {travellerTypes.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTravellerType(t.key)}
                    className={`rounded-xl border p-4 text-left transition ${
                      travellerType === t.key
                        ? "border-[var(--teal,#16756c)] bg-[var(--teal-soft,#dcefe9)] shadow-xs"
                        : "border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] hover:bg-[var(--hover,#f7f6f1)]"
                    }`}
                  >
                    <span className="font-serif text-base font-bold text-[var(--ink,#14231d)] block">
                      {t.title}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--muted,#53615a)] leading-relaxed">
                      {t.desc}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-[var(--line,#e2e6e1)] pt-5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted,#53615a)] hover:text-[var(--ink,#14231d)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--teal,#16756c)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#075b53] transition"
                >
                  Next: Trusted Contacts
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* =====================================================
              STEP 3: MULTIPLE TRUSTED CONTACTS
          ===================================================== */}
          {step === 3 && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal,#16756c)]">
                Safety Circle
              </span>
              <h1 className="mt-1 font-serif text-2xl font-bold text-[var(--ink,#14231d)] sm:text-3xl">
                Add trusted contacts
              </h1>
              <p className="mt-2 text-sm text-[var(--muted,#53615a)]">
                Designate people who can receive live trip sharing and arrival
                alerts. You can add one or more contacts, or skip this step.
              </p>

              {/* Already Added Contacts */}
              {contacts.length > 0 && (
                <div className="mt-5 space-y-2">
                  <span className="text-xs font-semibold text-[var(--muted,#53615a)]">
                    Configured Contacts ({contacts.length}):
                  </span>
                  <div className="space-y-2">
                    {contacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--line,#d8ddd7)] bg-[var(--card,#fbfbf9)] p-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Users className="h-4 w-4 text-[var(--teal,#16756c)]" />
                          <div>
                            <span className="font-bold text-[var(--ink,#14231d)]">
                              {c.name}
                            </span>{" "}
                            <span className="text-[var(--muted,#65746d)]">
                              ({c.relationship})
                            </span>
                            <p className="text-[11px] text-[var(--muted,#53615a)]">
                              {c.phone || c.email}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(c.id)}
                          className="text-[var(--muted,#62706a)] hover:text-[var(--coral,#b6433d)] transition p-1"
                          title="Remove contact"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Input Form */}
              <div className="mt-5 space-y-4 rounded-xl border border-[var(--line,#e2e6e1)] bg-[var(--card,#fbfbf9)] p-5">
                <span className="text-xs font-bold text-[var(--teal,#16756c)] uppercase tracking-wider">
                  {contacts.length === 0 ? "Add Contact" : "Add Another Contact"}
                </span>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted,#53615a)]">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={currentName}
                    onChange={(e) => setCurrentName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="mt-1.5 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-2.5 text-xs text-[var(--ink,#14231d)] outline-none focus:border-[var(--teal,#16756c)]"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted,#53615a)]">
                      Relationship
                    </label>
                    <select
                      value={currentRelationship}
                      onChange={(e) => setCurrentRelationship(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-2.5 text-xs text-[var(--ink,#14231d)] outline-none focus:border-[var(--teal,#16756c)]"
                    >
                      <option value="Family">Family</option>
                      <option value="Partner">Partner</option>
                      <option value="Friend">Friend</option>
                      <option value="Colleague">Colleague</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted,#53615a)]">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={currentPhone}
                      onChange={(e) => setCurrentPhone(e.target.value)}
                      placeholder="+91 98000 00000"
                      className="mt-1.5 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-2.5 text-xs text-[var(--ink,#14231d)] outline-none focus:border-[var(--teal,#16756c)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted,#53615a)]">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={currentEmail}
                    onChange={(e) => setCurrentEmail(e.target.value)}
                    placeholder="contact@example.com"
                    className="mt-1.5 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-2.5 text-xs text-[var(--ink,#14231d)] outline-none focus:border-[var(--teal,#16756c)]"
                  />
                </div>

                {currentName.trim() && (currentPhone.trim() || currentEmail.trim()) && (
                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--teal,#16756c)] bg-[var(--teal-soft,#dcefe9)] px-3 py-1.5 text-xs font-semibold text-[var(--teal,#075b53)] hover:bg-[#cbeae0] transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Save & Add Another
                  </button>
                )}
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-[var(--line,#e2e6e1)] pt-5">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted,#53615a)] hover:text-[var(--ink,#14231d)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <div className="flex items-center gap-3">
                  {contacts.length === 0 && !currentName && (
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="text-xs font-semibold text-[var(--muted,#53615a)] hover:text-[var(--ink,#14231d)]"
                    >
                      Skip this step
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (currentName.trim() && (currentPhone.trim() || currentEmail.trim())) {
                        handleAddContact();
                      }
                      setStep(4);
                    }}
                    className="inline-flex items-center gap-2 rounded-md bg-[var(--teal,#16756c)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#075b53] transition"
                  >
                    Next: Daily Routine
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================
              STEP 4: DAILY ROUTINE (OPTIONAL)
          ===================================================== */}
          {step === 4 && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal,#16756c)]">
                Quick Shortcuts
              </span>
              <h1 className="mt-1 font-serif text-2xl font-bold text-[var(--ink,#14231d)] sm:text-3xl">
                Daily Routine Shortcuts
              </h1>
              <p className="mt-2 text-sm text-[var(--muted,#53615a)]">
                Setting routine destinations allows one-tap context checking
                before heading out each morning or evening.
              </p>

              <div className="mt-6 space-y-4">
                {/* Morning Commute */}
                <div className="rounded-xl border border-[var(--line,#e2e6e1)] bg-[var(--card,#fbfbf9)] p-4">
                  <span className="text-xs font-bold text-[var(--teal,#16756c)] uppercase tracking-wider">
                    Morning Commute
                  </span>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--muted,#53615a)]">
                        Origin
                      </label>
                      <input
                        type="text"
                        value={morningOrigin}
                        onChange={(e) => setMorningOrigin(e.target.value)}
                        placeholder="e.g. Home, Bandra"
                        className="mt-1 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-2 text-xs text-[var(--ink,#14231d)]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--muted,#53615a)]">
                        Destination
                      </label>
                      <input
                        type="text"
                        value={morningDestination}
                        onChange={(e) => setMorningDestination(e.target.value)}
                        placeholder="e.g. Office, Shivaji Park"
                        className="mt-1 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-2 text-xs text-[var(--ink,#14231d)]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--muted,#53615a)]">
                        Typical Time
                      </label>
                      <input
                        type="time"
                        value={morningTime}
                        onChange={(e) => setMorningTime(e.target.value)}
                        className="mt-1 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-2 text-xs text-[var(--ink,#14231d)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Evening Commute */}
                <div className="rounded-xl border border-[var(--line,#e2e6e1)] bg-[var(--card,#fbfbf9)] p-4">
                  <span className="text-xs font-bold text-[var(--teal,#16756c)] uppercase tracking-wider">
                    Evening Commute
                  </span>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--muted,#53615a)]">
                        Origin
                      </label>
                      <input
                        type="text"
                        value={eveningOrigin}
                        onChange={(e) => setEveningOrigin(e.target.value)}
                        placeholder="e.g. Office, Shivaji Park"
                        className="mt-1 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-2 text-xs text-[var(--ink,#14231d)]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--muted,#53615a)]">
                        Destination
                      </label>
                      <input
                        type="text"
                        value={eveningDestination}
                        onChange={(e) => setEveningDestination(e.target.value)}
                        placeholder="e.g. Home, Bandra"
                        className="mt-1 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-2 text-xs text-[var(--ink,#14231d)]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--muted,#53615a)]">
                        Typical Time
                      </label>
                      <input
                        type="time"
                        value={eveningTime}
                        onChange={(e) => setEveningTime(e.target.value)}
                        className="mt-1 w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-2 text-xs text-[var(--ink,#14231d)]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-[var(--line,#e2e6e1)] pt-5">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted,#53615a)] hover:text-[var(--ink,#14231d)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeRoutine(false);
                      setStep(5);
                    }}
                    className="text-xs font-semibold text-[var(--muted,#53615a)] hover:text-[var(--ink,#14231d)]"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="inline-flex items-center gap-2 rounded-md bg-[var(--teal,#16756c)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#075b53] transition"
                  >
                    Next: Privacy & Permissions
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================
              STEP 5: PRIVACY & PERMISSIONS
          ===================================================== */}
          {step === 5 && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal,#16756c)]">
                Zero-Surveillance Architecture
              </span>
              <h1 className="mt-1 font-serif text-2xl font-bold text-[var(--ink,#14231d)] sm:text-3xl">
                Location & Privacy
              </h1>
              <p className="mt-2 text-sm text-[var(--muted,#53615a)]">
                SaferPath is architected so that your location is only accessed
                when you explicitly request it.
              </p>

              <div className="mt-6 rounded-xl border border-[var(--line,#d8ddd7)] bg-[var(--card,#fbfbf9)] p-5 text-xs text-[var(--muted,#53615a)] space-y-3">
                <div className="flex items-start gap-3">
                  <Lock className="h-4 w-4 text-[var(--teal,#16756c)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[var(--ink,#14231d)] block">
                      No continuous background tracking
                    </span>
                    Your coordinates are never logged silently in the background
                    while browsing routes.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="h-4 w-4 text-[var(--teal,#16756c)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[var(--ink,#14231d)] block">
                      Active Trip is strictly opt-in
                    </span>
                    GPS is only queried when you explicitly check the consent
                    box and tap "Start Trip".
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--ink,#14231d)]">
                    Enable Location for One-Tap Routing
                  </h4>
                  <p className="text-[11px] text-[var(--muted,#53615a)]">
                    Permits browser GPS lookup when tapping "Use current
                    location".
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRequestGeo}
                  className={`rounded-md px-4 py-2 text-xs font-semibold transition ${
                    geoPermissionGranted === true
                      ? "bg-[var(--teal-soft,#dcefe9)] text-[var(--teal,#075b53)] border border-[var(--teal,#16756c)]"
                      : "bg-[var(--teal,#16756c)] text-white hover:bg-[#075b53]"
                  }`}
                >
                  {geoPermissionGranted === true
                    ? "Enabled ✓"
                    : "Allow in browser"}
                </button>
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-[var(--line,#e2e6e1)] pt-5">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted,#53615a)] hover:text-[var(--ink,#14231d)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(6)}
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--teal,#16756c)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#075b53] transition"
                >
                  Next: Review & Finish
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* =====================================================
              STEP 6: CONFIRMATION & ENTER APP
          ===================================================== */}
          {step === 6 && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal,#16756c)]">
                Ready to explore
              </span>
              <h1 className="mt-1 font-serif text-2xl font-bold text-[var(--ink,#14231d)] sm:text-3xl">
                You're ready to use SaferPath
              </h1>
              <p className="mt-2 text-sm text-[var(--muted,#53615a)]">
                Here is a summary of your profile preferences:
              </p>

              <div className="mt-6 space-y-3 rounded-xl border border-[var(--line,#d8ddd7)] bg-[var(--card,#fbfbf9)] p-5 text-xs">
                <div className="flex justify-between border-b border-[var(--line,#e2e6e1)] pb-2">
                  <span className="text-[var(--muted,#53615a)]">Display Name:</span>
                  <span className="font-semibold text-[var(--ink,#14231d)]">
                    {displayName || "Anonymous Traveller"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[var(--line,#e2e6e1)] pb-2">
                  <span className="text-[var(--muted,#53615a)]">Traveller Type:</span>
                  <span className="font-semibold text-[var(--ink,#14231d)]">
                    {travellerType}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[var(--line,#e2e6e1)] pb-2">
                  <span className="text-[var(--muted,#53615a)]">Language:</span>
                  <span className="font-semibold text-[var(--ink,#14231d)]">
                    {language}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[var(--line,#e2e6e1)] pb-2">
                  <span className="text-[var(--muted,#53615a)]">Trusted Contacts:</span>
                  <span className="font-semibold text-[var(--ink,#14231d)]">
                    {contacts.length > 0
                      ? `${contacts.length} contact${contacts.length > 1 ? "s" : ""} saved`
                      : currentName
                        ? `${currentName} (${currentRelationship})`
                        : "None configured"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted,#53615a)]">Daily Shortcuts:</span>
                  <span className="font-semibold text-[var(--ink,#14231d)]">
                    {includeRoutine ? "Morning & Evening routes saved" : "None"}
                  </span>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-[var(--line,#e2e6e1)] pt-5">
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted,#53615a)] hover:text-[var(--ink,#14231d)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleComplete()}
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--teal,#16756c)] px-6 py-3 text-sm font-semibold text-white hover:bg-[#075b53] transition disabled:opacity-50"
                >
                  {busy ? "Entering SaferPath..." : "Start using SaferPath"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
