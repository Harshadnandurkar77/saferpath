import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Phone, ShieldCheck } from "lucide-react";
import { createEmergencyHandoff, submitEmergencyHandoffAction } from "../../api/emergency";

type Stage = "idle" | "holding" | "confirm" | "countdown" | "complete" | "error";
const HOLD_MS = 2000;

export function GlobalEmergencyAction() {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [seconds, setSeconds] = useState(3);
  const [message, setMessage] = useState("");
  const holdStart = useRef(0);
  const holdFrame = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);
  const cooldownUntil = useRef(0);

  useEffect(() => () => { if (holdFrame.current) cancelAnimationFrame(holdFrame.current); if (countdownTimer.current) window.clearInterval(countdownTimer.current); }, []);

  const stopHold = () => {
    if (holdFrame.current) cancelAnimationFrame(holdFrame.current);
    holdFrame.current = null;
    if (stage === "holding") { setStage("idle"); setProgress(0); }
  };

  const startHold = () => {
    if (Date.now() < cooldownUntil.current || stage !== "idle") return;
    holdStart.current = Date.now();
    setStage("holding");
    const tick = () => {
      const next = Math.min(1, (Date.now() - holdStart.current) / HOLD_MS);
      setProgress(next);
      if (next >= 1) { setStage("confirm"); setProgress(0); return; }
      holdFrame.current = requestAnimationFrame(tick);
    };
    holdFrame.current = requestAnimationFrame(tick);
  };

  const confirm = () => {
    setStage("countdown");
    setSeconds(3);
    let remaining = 3;
    countdownTimer.current = window.setInterval(() => {
      remaining -= 1;
      setSeconds(remaining);
      if (remaining === 0) { window.clearInterval(countdownTimer.current!); countdownTimer.current = null; void initiate(); }
    }, 1000);
  };

  const cancelCountdown = () => { if (countdownTimer.current) window.clearInterval(countdownTimer.current); countdownTimer.current = null; setStage("idle"); };

  const initiate = async () => {
    if (Date.now() < cooldownUntil.current) return;
    cooldownUntil.current = Date.now() + 30_000;
    const tripId = sessionStorage.getItem("saferpath-active-trip");
    try {
      if (tripId) {
        const handoff = await createEmergencyHandoff({ trip_id: tripId, method: "OFFICIAL_CALL", explicit_user_action: true, consent_version: "1.0", consent_source: "global_emergency_hold" });
        await submitEmergencyHandoffAction(handoff.handoff_id, "CALL_INITIATED");
        console.warn("[SaferPath Emergency] Official 112 handoff initiated", { handoffId: handoff.handoff_id, tripId });
        setMessage("Emergency handoff initiated. The official 112 call action was opened. Trusted-contact alerts are only shown as sent when a notification provider confirms delivery.");
      } else {
        console.warn("[SaferPath Emergency] 112 call opened without an active trip; no trusted-contact alert was sent.");
        setMessage("Emergency handoff initiated. No active trip was available, so trusted contacts were not alerted.");
      }
      setStage("complete");
      window.location.href = "tel:112";
    } catch (error) {
      console.error("[SaferPath Emergency] Handoff failed", error);
      setMessage(error instanceof Error ? error.message : "Emergency handoff could not be recorded. You can still call 112.");
      setStage("error");
    }
  };

  return <>
    <button type="button" onPointerDown={startHold} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}
      className="fixed bottom-20 right-4 z-40 inline-flex select-none items-center gap-2 rounded-full bg-[#b6433d] px-4 py-3 text-xs font-bold text-white shadow-lg shadow-red-950/20 transition hover:bg-[#99342f] md:bottom-5 md:right-6"
      aria-label="Hold for two seconds to open emergency confirmation">
      <span className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: `${progress * 100}%` }} />
      <AlertTriangle className="relative h-4 w-4" /><span className="relative">{stage === "holding" ? "Keep holding…" : "Emergency 112"}</span>
    </button>
    {stage !== "idle" && stage !== "holding" && <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-[var(--surface,#fffefb)] p-6 shadow-2xl">
        {stage === "confirm" && <><AlertTriangle className="h-8 w-8 text-[#b6433d]" /><h2 className="mt-4 font-serif text-2xl font-bold">Contact emergency services?</h2><p className="mt-2 text-sm text-[var(--muted,#53615a)]">Are you sure you want to contact emergency services and alert your trusted contacts? This opens the official 112 call action after a visible countdown.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setStage("idle")} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button><button onClick={confirm} className="rounded-lg bg-[#b6433d] px-4 py-2 text-sm font-bold text-white">Confirm emergency</button></div></>}
        {stage === "countdown" && <div className="text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-red-50 text-3xl font-bold text-[#b6433d]">{seconds}</div><h2 className="mt-4 font-serif text-xl font-bold">Emergency handoff starting</h2><p className="mt-2 text-sm text-[var(--muted,#53615a)]">Preparing the official 112 call action.</p><button onClick={cancelCountdown} className="mt-5 rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button></div>}
        {(stage === "complete" || stage === "error") && <div><ShieldCheck className={`h-8 w-8 ${stage === "complete" ? "text-[var(--teal,#16756c)]" : "text-[#b6433d]"}`} /><h2 className="mt-4 font-serif text-xl font-bold">{stage === "complete" ? "Emergency handoff initiated" : "Call 112 directly"}</h2><p className="mt-2 text-sm text-[var(--muted,#53615a)]">{message}</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setStage("idle")} className="rounded-lg border px-4 py-2 text-sm font-semibold">Close</button>{stage === "error" && <a href="tel:112" className="rounded-lg bg-[#b6433d] px-4 py-2 text-sm font-bold text-white"><Phone className="mr-1 inline h-4 w-4" />Call 112</a>}</div></div>}
      </div>
    </div>}
  </>;
}
