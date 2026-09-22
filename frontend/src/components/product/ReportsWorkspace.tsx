import { useState } from "react";
import { CheckCircle2, Clock, FileText, Info, Plus, UploadCloud, X } from "lucide-react";
import { authorizeEvidenceUpload, completeEvidenceUpload, createReport, REPORT_CATEGORIES } from "../../api/reports";
import type { CoarseArea, PublicationIntent, ReportCategory, ReportResponse } from "../../api/types";

const COARSE_AREAS: { id: CoarseArea; label: string }[] = [
  { id: "MUMBAI_SOUTH", label: "Mumbai South (Colaba, Fort, Marine Lines)" },
  { id: "MUMBAI_CENTRAL", label: "Mumbai Central (Dadar, Worli, Byculla)" },
  { id: "MUMBAI_WEST", label: "Mumbai West (Bandra, Khar, Andheri, Juhu)" },
  { id: "MUMBAI_NORTH", label: "Mumbai North (Borivali, Kandivali, Malad)" },
  { id: "MUMBAI_EAST", label: "Mumbai East (Ghatkopar, Kurla, Chembur)" },
];

export function ReportsWorkspace() {
  const [reports, setReports] = useState<ReportResponse[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successReference, setSuccessReference] = useState<string | null>(null);

  // Form states
  const [category, setCategory] = useState<ReportCategory>("LIGHTING");
  const [coarseArea, setCoarseArea] = useState<CoarseArea>("MUMBAI_WEST");
  const [publicationIntent, setPublicationIntent] = useState<PublicationIntent>("PUBLIC_CONTEXT");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessReference(null);

    try {
      // Current ISO timestamp with timezone offset
      const observedAt = new Date().toISOString();

      const newReport = await createReport({
        category,
        coarse_area: coarseArea,
        observed_at: observedAt,
        publication_intent: publicationIntent,
      });

      // If user attached evidence (optional photo/document)
      if (selectedFile) {
        try {
          const auth = await authorizeEvidenceUpload(
            newReport.report_id,
            selectedFile.type || "application/octet-stream",
            selectedFile.size
          );

          const arrayBuffer = await selectedFile.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          await completeEvidenceUpload(
            newReport.report_id,
            auth.evidence_id,
            auth.upload_token,
            base64
          );
        } catch {
          // Evidence upload failure is non-fatal for the report itself
        }
      }

      setReports((prev) => [newReport, ...prev.filter((r) => r.report_id !== newReport.report_id)]);
      setSuccessReference(newReport.reference);
      setSelectedFile(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16756c]">
            Structured Incident Context
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-[#14231d]">
            Reports & Observational Evidence
          </h1>
          <p className="mt-1 text-xs text-[#62706a]">
            Structured, coarse-location observations. Submitted reports are moderated before incorporation into context.
          </p>
        </div>
        <button
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            setSuccessReference(null);
            setErrorMessage(null);
          }}
          className="flex items-center gap-2 bg-[#16756c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#075b53]"
        >
          {isFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isFormOpen ? "Close form" : "Submit a report"}
        </button>
      </div>

      {/* ── Privacy & Policy Disclaimer ── */}
      <div className="mb-6 border border-[#d8ddd7] bg-[#fffefb] p-4 text-xs leading-5 text-[#53615a] shadow-sm">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#16756c]" />
          <div>
            <p className="font-semibold text-[#14231d]">Privacy & Data Integrity Notice</p>
            <p className="mt-0.5">
              To protect community safety and personal privacy, SaferPath does not store free-text notes, personal descriptions, or exact home coordinates in reports. All observations are categorized and linked to coarse geographical sectors.
            </p>
          </div>
        </div>
      </div>

      {/* ── Report Submission Form ── */}
      {isFormOpen && (
        <section className="mb-8 border-t-2 border-[#16756c] bg-[#fffefb] p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-[#14231d]">
            Submit a Structured Observation
          </h2>
          <p className="mt-1 text-xs text-[#62706a]">
            Help inform pedestrian context across Mumbai. All submissions are processed by backend moderation.
          </p>

          {successReference ? (
            <div className="mt-5 border border-[#16756c] bg-[#dcefe9] p-5 text-sm text-[#075b53]">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5 text-[#16756c]" />
                Report received with reference: {successReference}
              </div>
              <p className="mt-2 text-xs text-[#14231d]">
                Your report has been stored securely and queued for review. Its moderation status is currently <span className="font-semibold">PENDING</span>.
              </p>
              <button
                onClick={() => setIsFormOpen(false)}
                className="mt-4 bg-[#16756c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#075b53]"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {errorMessage && (
                <div role="alert" className="border-l-4 border-[#b6433d] bg-[#fde8e7] p-3 text-xs text-[#b6433d]">
                  {errorMessage}
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                  Category of Observation
                </label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {REPORT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`border p-3 text-left transition ${
                        category === cat.id
                          ? "border-[#16756c] bg-[#dcefe9]"
                          : "border-[#d8ddd7] bg-[#fffefb] hover:bg-[#f0f2ed]"
                      }`}
                    >
                      <span className="block text-xs font-semibold text-[#14231d]">{cat.label}</span>
                      <span className="mt-0.5 block text-[11px] text-[#62706a]">{cat.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Coarse Area */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                  Coarse Area (Mumbai Sector)
                </label>
                <select
                  value={coarseArea}
                  onChange={(e) => setCoarseArea(e.target.value as CoarseArea)}
                  className="mt-2 w-full border border-[#aab7af] bg-white p-3 text-sm text-[#14231d] outline-none"
                >
                  {COARSE_AREAS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-[#62706a]">
                  Precise GPS is not broadcast to protect individual privacy.
                </p>
              </div>

              {/* Publication Intent */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                  Publication Intent
                </label>
                <div className="mt-2 flex gap-3">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="intent"
                      checked={publicationIntent === "PUBLIC_CONTEXT"}
                      onChange={() => setPublicationIntent("PUBLIC_CONTEXT")}
                      className="text-[#16756c]"
                    />
                    <span className="font-medium text-[#14231d]">Public Route Context</span>
                    <span className="text-[#62706a]">(Aggregated anonymously after moderation)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="intent"
                      checked={publicationIntent === "RESTRICTED_EVIDENCE"}
                      onChange={() => setPublicationIntent("RESTRICTED_EVIDENCE")}
                      className="text-[#16756c]"
                    />
                    <span className="font-medium text-[#14231d]">Restricted Evidence</span>
                    <span className="text-[#62706a]">(Audit log only)</span>
                  </label>
                </div>
              </div>

              {/* Optional Evidence File */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                  Supporting Evidence Photo / File (Optional)
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 border border-[#d8ddd7] bg-[#f7f6f1] px-4 py-2 text-xs font-semibold text-[#53615a] hover:bg-[#f0f2ed]">
                    <UploadCloud className="h-4 w-4 text-[#16756c]" />
                    <span>{selectedFile ? selectedFile.name : "Choose file"}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-xs text-[#b6433d] hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Submit button */}
              <div className="border-t border-[#d8ddd7] pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#16756c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#075b53] disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting observation..." : "Submit report to server"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* ── Reports List ── */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#62706a]">
          Your Tracked Reports ({reports.length})
        </h2>

        {reports.length > 0 ? (
          <div className="divide-y border border-[#d8ddd7] bg-[#fffefb] shadow-sm">
            {reports.map((report) => (
              <div key={report.report_id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-[#14231d]">
                      {report.category.replace(/_/g, " ")}
                    </span>
                    <span className="ml-2 text-xs text-[#62706a]">Ref: {report.reference}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block border px-2 py-0.5 text-[10px] font-semibold ${
                        report.moderation_status === "ACCEPTED_PUBLIC_CONTEXT"
                          ? "border-[#16756c] bg-[#dcefe9] text-[#075b53]"
                          : report.moderation_status === "PENDING"
                          ? "border-[#9a6400] bg-[#fcf3d9] text-[#9a6400]"
                          : "border-[#d8ddd7] bg-[#f0f2ed] text-[#53615a]"
                      }`}
                    >
                      {report.moderation_status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[#53615a]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[#62706a]" />
                    Observed: {new Date(report.observed_at).toLocaleString()}
                  </span>
                  <span>Sector: {report.coarse_area || "Mumbai pilot"}</span>
                  <span>Intent: {report.publication_intent.replace(/_/g, " ")}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-[#d8ddd7] bg-[#fffefb] p-8 text-center text-sm text-[#53615a]">
            <FileText className="mx-auto h-8 w-8 text-[#62706a]" />
            <p className="mt-3 font-semibold text-[#14231d]">No reports submitted yet in this session</p>
            <p className="mt-1 text-xs text-[#62706a]">Reports created during this view appear here. A server-side report-history endpoint is not available yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}
