import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Navigation,
  Phone,
  Plus,
  RefreshCw,
  Share2,
  Shield,
  StopCircle,
  UserCheck,
  UserX,
} from "lucide-react";
import { checkInTrip, getTrip, respondToDeviation, stopTrip, tripStreamUrl } from "../../api/trips";
import {
  createSharingGrant,
  createTrustedContact,
  listTrustedContacts,
  revokeSharingGrant,
  revokeTrustedContact,
  verifyTrustedContact,
} from "../../api/trustedContacts";
import { createEmergencyHandoff, submitEmergencyHandoffAction } from "../../api/emergency";
import type {
  SharingGrantResponse,
  TripPollResponse,
  TrustedContactResponse,
} from "../../api/types";
import { Link } from "react-router-dom";

export function TripsWorkspace() {
  const [activeTripId, setActiveTripId] = useState<string | null>(() =>
    sessionStorage.getItem("saferpath_current_trip_id")
  );
  const [tripState, setTripState] = useState<TripPollResponse | null>(null);
  const [contacts, setContacts] = useState<TrustedContactResponse[]>([]);
  const [grants, setGrants] = useState<SharingGrantResponse[]>([]);

  // Action status states
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [networkDegraded, setNetworkDegraded] = useState(false);

  // Trusted contact form state
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactReference, setContactReference] = useState("");
  const [relationship, setRelationship] = useState("Family");
  const [verificationInput, setVerificationInput] = useState<{ id: string; token: string } | null>(null);

  // Poll trip data from backend
  const fetchTrip = useCallback(async (id: string) => {
    try {
      const data = await getTrip(id);
      setTripState(data);
      if (data.status === "STOPPED" || data.status === "COMPLETED" || data.status === "EXPIRED") {
        sessionStorage.removeItem("saferpath_current_trip_id");
      }
    } catch {
      // Trip not found or closed
    }
  }, []);

  // Poll contacts
  const fetchContacts = useCallback(async () => {
    try {
      const list = await listTrustedContacts();
      setContacts(list);
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    void fetchContacts();
    if (activeTripId) {
      void fetchTrip(activeTripId);
      const stream = new EventSource(tripStreamUrl(activeTripId));
      stream.onopen = () => setNetworkDegraded(false);
      stream.onmessage = () => void fetchTrip(activeTripId);
      stream.onerror = () => setNetworkDegraded(true);
      const interval = setInterval(() => {
        void fetchTrip(activeTripId);
      }, 10000);
      return () => { stream.close(); clearInterval(interval); };
    }
  }, [activeTripId, fetchContacts, fetchTrip]);

  // Handle Check-in
  const handleCheckIn = async () => {
    if (!activeTripId) return;
    setIsLoading(true);
    setActionMessage(null);
    setErrorMessage(null);
    try {
      await checkInTrip(activeTripId);
      setActionMessage("Check-in confirmed with server. Status: OK.");
      await fetchTrip(activeTripId);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to record check-in.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Stop Trip
  const handleStopTrip = async () => {
    if (!activeTripId) return;
    if (!window.confirm("Are you sure you want to end this active journey?")) return;
    setIsLoading(true);
    setActionMessage(null);
    setErrorMessage(null);
    try {
      await stopTrip(activeTripId);
      sessionStorage.removeItem("saferpath_current_trip_id");
      setActiveTripId(null);
      setTripState(null);
      setActionMessage("Trip completed and recorded.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to stop trip.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Deviation Response
  const handleDeviationResponse = async (
    resp: "CONFIRM_ROUTE_CHANGE" | "REJECT_ROUTE_CHANGE" | "UNSURE"
  ) => {
    if (!activeTripId) return;
    setIsLoading(true);
    try {
      await respondToDeviation(activeTripId, resp);
      setActionMessage(`Response recorded: ${resp.replace(/_/g, " ")}`);
      await fetchTrip(activeTripId);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to record deviation response.");
    } finally {
      setIsLoading(false);
    }
  };

  // Add Trusted Contact
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactReference.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const newContact = await createTrustedContact({
        display_name: contactName.trim(),
        contact_reference: contactReference.trim(),
        relationship_label: relationship,
      });
      setContacts((prev) => [newContact, ...prev]);
      setIsAddContactOpen(false);
      setContactName("");
      setContactReference("");
      if (newContact.verification_token) {
        setActionMessage(`Contact added. Verification token for testing: ${newContact.verification_token}`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to add contact.");
    } finally {
      setIsLoading(false);
    }
  };

  // Verify Contact
  const handleVerifyContact = async (contactId: string, token: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const verified = await verifyTrustedContact(contactId, token);
      setContacts((prev) => prev.map((c) => (c.contact_id === verified.contact_id ? verified : c)));
      setVerificationInput(null);
      setActionMessage("Trusted contact verified.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Invalid or expired verification token.");
    } finally {
      setIsLoading(false);
    }
  };

  // Revoke Contact
  const handleRevokeContact = async (contactId: string) => {
    if (!window.confirm("Revoke this trusted contact?")) return;
    setIsLoading(true);
    try {
      await revokeTrustedContact(contactId);
      setContacts((prev) => prev.filter((c) => c.contact_id !== contactId));
      setActionMessage("Trusted contact revoked.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to revoke contact.");
    } finally {
      setIsLoading(false);
    }
  };

  // Share active trip with contact
  const handleShareWithContact = async (contactId: string) => {
    if (!activeTripId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const grant = await createSharingGrant({
        trip_id: activeTripId,
        contact_id: contactId,
        scope: "STATUS_ONLY",
      });
      setGrants((prev) => [grant, ...prev]);
      setActionMessage("Sharing grant created with STATUS_ONLY scope.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not create sharing grant.");
    } finally {
      setIsLoading(false);
    }
  };

  // Revoke Grant
  const handleRevokeGrant = async (grantId: string) => {
    setIsLoading(true);
    try {
      await revokeSharingGrant(grantId);
      setGrants((prev) => prev.filter((g) => g.grant_id !== grantId));
      setActionMessage("Sharing grant revoked.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to revoke sharing grant.");
    } finally {
      setIsLoading(false);
    }
  };

  // Official Emergency Handoff
  const handleEmergencyHandoff = async () => {
    if (!activeTripId) return;
    if (!window.confirm("Initiate official emergency assistance handoff?")) return;
    setIsLoading(true);
    try {
      const handoff = await createEmergencyHandoff({
        trip_id: activeTripId,
        method: "OFFICIAL_CALL",
        explicit_user_action: true,
        consent_version: "2026-01",
        consent_source: "active_trip_emergency_surface",
      });
      await submitEmergencyHandoffAction(handoff.handoff_id, "CALL_INITIATED");
      setActionMessage("Emergency handoff recorded. Connecting to 112...");
      window.location.href = "tel:112";
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Emergency handoff failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16756c]">
            Active Trip Companion & Sharing
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-[#14231d]">
            Trips & Trusted Contacts
          </h1>
          <p className="mt-1 text-xs text-[#62706a]">
            A calm check-in companion. Never continuous surveillance or unconsented location broadcasting.
          </p>
        </div>
        {activeTripId && (
          <button
            onClick={() => void fetchTrip(activeTripId)}
            className="flex items-center gap-1.5 border border-[#d8ddd7] bg-[#fffefb] px-3.5 py-2 text-xs font-semibold text-[#53615a] hover:bg-[#f0f2ed]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh status
          </button>
        )}
      </div>

      {/* ── Status Messages ── */}
      {actionMessage && (
        <div role="status" className="mb-6 border-l-4 border-[#16756c] bg-[#dcefe9] p-4 text-xs font-medium text-[#075b53]">
          {actionMessage}
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="mb-6 border-l-4 border-[#b6433d] bg-[#fde8e7] p-4 text-xs font-medium text-[#b6433d]">
          {errorMessage}
        </div>
      )}

      {networkDegraded && (
        <div role="status" className="mb-6 border-l-4 border-[#9a6400] bg-[#fcf3d9] p-4 text-xs text-[#53615a]">
          Live trip updates are unavailable; SaferPath is refreshing this trip from the server every 10 seconds.
        </div>
      )}

      {/* ── Active Trip Section ── */}
      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#62706a]">
          Active Journey Status
        </h2>

        {activeTripId && tripState ? (
          <div className="border-t-2 border-[#16756c] bg-[#fffefb] p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#16756c] opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#16756c]"></span>
                  </span>
                  <h3 className="font-serif text-lg font-semibold text-[#14231d]">
                    Trip in Progress · {tripState.travel_mode}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-[#62706a]">
                  Trip ID: {tripState.trip_id} · Sharing: {tripState.sharing_scope}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleCheckIn()}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 bg-[#16756c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#075b53] disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  I'm okay (Check in)
                </button>
                <button
                  onClick={() => void handleStopTrip()}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 border border-[#b6433d] px-4 py-2 text-xs font-semibold text-[#b6433d] hover:bg-[#fde8e7] disabled:opacity-50"
                >
                  <StopCircle className="h-4 w-4" />
                  End journey
                </button>
              </div>
            </div>

            {/* Smart Deviation Banner */}
            {tripState.deviation && (
              <div className="mt-5 border-l-4 border-[#9a6400] bg-[#fcf3d9] p-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9a6400]" />
                  <div>
                    <p className="font-semibold text-[#14231d]">
                      Route Corridor Deviation Detected
                    </p>
                    <p className="mt-0.5 text-[#53615a]">
                      You appear to have moved away from the planned corridor. Are you okay?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => void handleDeviationResponse("CONFIRM_ROUTE_CHANGE")}
                        className="bg-[#16756c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#075b53]"
                      >
                        I'm taking an alternate route
                      </button>
                      <button
                        onClick={() => void handleDeviationResponse("UNSURE")}
                        className="border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs font-medium text-[#14231d] hover:bg-[#f0f2ed]"
                      >
                        Unsure / checking map
                      </button>
                      <button
                        onClick={() => void handleEmergencyHandoff()}
                        className="bg-[#b6433d] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        I need assistance (112)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Trip Details Grid */}
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#d8ddd7] pt-5 sm:grid-cols-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#62706a]">Planned Arrival</span>
                <p className="mt-1 text-sm font-semibold text-[#14231d]">
                  {new Date(tripState.planned_arrival).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#62706a]">Status</span>
                <p className="mt-1 text-sm font-semibold text-[#16756c]">{tripState.status}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#62706a]">Last Server Sync</span>
                <p className="mt-1 text-xs text-[#53615a]">
                  {new Date(tripState.last_update_at).toLocaleTimeString()}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#62706a]">Data Retention</span>
                <p className="mt-1 text-xs text-[#53615a]">7 days (Policy 2026-01)</p>
              </div>
            </div>

            {/* Emergency Action Strip */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#d8ddd7] pt-5">
              <div className="flex items-center gap-2 text-xs text-[#62706a]">
                <Shield className="h-4 w-4 text-[#16756c]" />
                Official emergency handoff: Calls local emergency authorities.
              </div>
              <button
                onClick={() => void handleEmergencyHandoff()}
                className="flex items-center gap-1.5 border border-[#b6433d] px-3 py-1.5 text-xs font-semibold text-[#b6433d] hover:bg-[#fde8e7]"
              >
                <Phone className="h-3.5 w-3.5" />
                Emergency 112 Handoff
              </button>
            </div>
          </div>
        ) : (
          <div className="border border-[#d8ddd7] bg-[#fffefb] p-8 text-center shadow-sm">
            <Navigation className="mx-auto h-8 w-8 text-[#62706a]" />
            <p className="mt-3 font-serif text-lg font-semibold text-[#14231d]">
              No active journey
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-[#62706a]">
              Start a journey from Route Planning to enable time-aware check-in reminders and optional trusted-contact sharing.
            </p>
            <Link
              to="/home"
              className="mt-5 inline-block bg-[#16756c] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#075b53]"
            >
              Plan a route →
            </Link>
          </div>
        )}
      </section>

      {/* ── Trusted Contacts & Sharing Section ── */}
      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#62706a]">
              Trusted Contacts ({contacts.length})
            </h2>
            <p className="text-xs text-[#62706a]">
              Contacts you can share check-in status or trip context with.
            </p>
          </div>
          <button
            onClick={() => setIsAddContactOpen(!isAddContactOpen)}
            className="flex items-center gap-1.5 border border-[#d8ddd7] bg-[#fffefb] px-3 py-1.5 text-xs font-semibold text-[#53615a] hover:bg-[#f0f2ed]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add trusted contact
          </button>
        </div>

        {/* Add Contact Modal / Inline Form */}
        {isAddContactOpen && (
          <form onSubmit={handleAddContact} className="mb-6 border border-[#d8ddd7] bg-[#fffefb] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#14231d]">Add a Trusted Contact</h3>
            <p className="mt-1 text-xs text-[#62706a]">
              Contact details are used strictly for status sharing. No marketing or external notifications.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-[#62706a]">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="mt-1 w-full border border-[#d8ddd7] p-2 text-xs outline-none focus:border-[#16756c]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#62706a]">Email or Reference</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. priya@example.com"
                  value={contactReference}
                  onChange={(e) => setContactReference(e.target.value)}
                  className="mt-1 w-full border border-[#d8ddd7] p-2 text-xs outline-none focus:border-[#16756c]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#62706a]">Relationship</label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="mt-1 w-full border border-[#d8ddd7] bg-white p-2 text-xs outline-none"
                >
                  <option value="Family">Family</option>
                  <option value="Friend">Friend</option>
                  <option value="Partner">Partner</option>
                  <option value="Colleague">Colleague</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-[#16756c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#075b53] disabled:opacity-50"
              >
                Save contact
              </button>
              <button
                type="button"
                onClick={() => setIsAddContactOpen(false)}
                className="border border-[#d8ddd7] px-4 py-2 text-xs text-[#62706a] hover:bg-[#f0f2ed]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Verification Modal Input */}
        {verificationInput && (
          <div className="mb-6 border border-[#16756c] bg-[#dcefe9] p-4 text-xs">
            <h4 className="font-semibold text-[#075b53]">Verify Contact</h4>
            <p className="mt-1 text-[#14231d]">
              Enter the verification token provided by your contact:
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Verification token"
                value={verificationInput.token}
                onChange={(e) =>
                  setVerificationInput({ ...verificationInput, token: e.target.value })
                }
                className="border border-[#aab7af] bg-white p-2 text-xs outline-none"
              />
              <button
                onClick={() => void handleVerifyContact(verificationInput.id, verificationInput.token)}
                className="bg-[#16756c] px-4 py-2 font-semibold text-white hover:bg-[#075b53]"
              >
                Submit token
              </button>
              <button
                onClick={() => setVerificationInput(null)}
                className="border border-[#d8ddd7] bg-white px-3 py-2 text-[#62706a]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Contacts List */}
        {contacts.length > 0 ? (
          <div className="divide-y border border-[#d8ddd7] bg-[#fffefb] shadow-sm">
            {contacts.map((contact) => (
              <div key={contact.contact_id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#14231d]">{contact.display_name}</span>
                    <span className="text-[#62706a]">({contact.relationship_label})</span>
                    <span
                      className={`border px-1.5 py-0.5 text-[10px] font-semibold ${
                        contact.verification_status === "VERIFIED"
                          ? "border-[#16756c] bg-[#dcefe9] text-[#075b53]"
                          : "border-[#9a6400] bg-[#fcf3d9] text-[#9a6400]"
                      }`}
                    >
                      {contact.verification_status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[#62706a]">{contact.contact_reference}</p>
                </div>

                <div className="flex items-center gap-2">
                  {contact.verification_status !== "VERIFIED" && (
                    <button
                      onClick={() =>
                        setVerificationInput({ id: contact.contact_id, token: contact.verification_token || "" })
                      }
                      className="flex items-center gap-1 border border-[#16756c] px-2.5 py-1.5 text-xs font-semibold text-[#075b53] hover:bg-[#dcefe9]"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Verify
                    </button>
                  )}

                  {activeTripId && (
                    <button
                      onClick={() => void handleShareWithContact(contact.contact_id)}
                      className="flex items-center gap-1 bg-[#16756c] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#075b53]"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share trip
                    </button>
                  )}

                  <button
                    onClick={() => void handleRevokeContact(contact.contact_id)}
                    className="flex items-center gap-1 text-[#b6433d] hover:underline"
                  >
                    <UserX className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-[#d8ddd7] bg-[#fffefb] p-6 text-center text-xs text-[#62706a]">
            No trusted contacts configured. Add a contact to enable status sharing.
          </div>
        )}
      </section>

      {/* ── Active Sharing Grants ── */}
      {grants.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#62706a]">
            Active Trip Sharing Grants ({grants.length})
          </h2>
          <div className="divide-y border border-[#d8ddd7] bg-[#fffefb] shadow-sm">
            {grants.map((grant) => (
              <div key={grant.grant_id} className="flex items-center justify-between p-4 text-xs">
                <div>
                  <span className="font-semibold text-[#14231d]">
                    Scope: {grant.scope} · Status: {grant.status}
                  </span>
                  <p className="mt-0.5 text-[#62706a]">
                    Issued: {new Date(grant.issued_at).toLocaleTimeString()} · Expires: {new Date(grant.expires_at).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => void handleRevokeGrant(grant.grant_id)}
                  className="text-xs font-semibold text-[#b6433d] hover:underline"
                >
                  Revoke grant
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Guidance Note ── */}
      <div className="flex items-start gap-2 border border-[#d8ddd7] bg-[#fffefb] p-4 text-xs text-[#53615a]">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#16756c]" />
        <p>
          Trip state is retained for 7 days in accordance with the data retention policy. Check-in prompts occur periodically before your planned arrival time.
        </p>
      </div>
    </div>
  );
}
