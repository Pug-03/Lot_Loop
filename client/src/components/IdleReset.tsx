import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../state/SessionContext";

const IDLE_MS = 5 * 60 * 1000;
// 45s (was 20s): older customers reading the screen or handling cash need more
// time to notice the warning and tap "stay" before the session resets.
const WARN_MS = 45 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel"] as const;

export default function IdleReset() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const { resetSession } = useSession();
  const [warnAt, setWarnAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const warnTimer = useRef<number | null>(null);
  const resetTimer = useRef<number | null>(null);

  function clearTimers() {
    if (warnTimer.current !== null) window.clearTimeout(warnTimer.current);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    warnTimer.current = null;
    resetTimer.current = null;
  }

  function scheduleIdle() {
    clearTimers();
    setWarnAt(null);
    warnTimer.current = window.setTimeout(() => {
      setWarnAt(Date.now() + WARN_MS);
      resetTimer.current = window.setTimeout(doReset, WARN_MS);
    }, IDLE_MS - WARN_MS);
  }

  async function doReset() {
    clearTimers();
    setWarnAt(null);
    await resetSession(); // also clears PDPA consent for the next customer
    nav("/identity", { replace: true });
  }

  useEffect(() => {
    const onActivity = () => {
      if (warnAt !== null) return;
      scheduleIdle();
    };
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true });
    scheduleIdle();
    return () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity);
      clearTimers();
    };
  }, [warnAt]);

  useEffect(() => {
    if (loc.pathname === "/identity") {
      clearTimers();
      setWarnAt(null);
      scheduleIdle();
    }
  }, [loc.pathname]);

  useEffect(() => {
    if (warnAt === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [warnAt]);

  if (warnAt === null) return null;
  const secondsLeft = Math.max(0, Math.ceil((warnAt - now) / 1000));

  return (
    <div className="modal-back" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="modal">
        <h3 id="idle-title">{t("idle.title")}</h3>
        <p className="note">{t("idle.body", { seconds: secondsLeft })}</p>
        <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={doReset}>{t("idle.reset_now")}</button>
          <button className="btn big" onClick={scheduleIdle}>{t("idle.stay")}</button>
        </div>
      </div>
    </div>
  );
}
