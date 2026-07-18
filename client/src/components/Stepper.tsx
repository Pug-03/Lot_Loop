import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useSession } from "../state/SessionContext";

const IDENTITY_STEP = { path: "/identity", key: "stepper.identity", icon: "mdi:shield-account-outline" };

// The buy flow and the prize-claim flow share the identity step, then diverge.
const BUY_STEPS = [
  IDENTITY_STEP,
  { path: "/recycle", key: "stepper.recycle", icon: "mdi:ticket-confirmation-outline" },
  { path: "/select", key: "stepper.select", icon: "mdi:numeric" },
  { path: "/payment", key: "stepper.payment", icon: "mdi:cash-multiple" },
] as const;

const CLAIM_STEPS = [
  IDENTITY_STEP,
  { path: "/claim", key: "stepper.claim", icon: "mdi:cash-multiple" },
] as const;

export default function Stepper() {
  const { t } = useTranslation();
  const loc = useLocation();
  const { flowMode } = useSession();
  const STEPS = flowMode === "claim" ? CLAIM_STEPS : BUY_STEPS;
  const activeIndex = STEPS.findIndex((s) => loc.pathname.startsWith(s.path));
  if (activeIndex < 0) return null;

  return (
    <nav className="stepper" aria-label="progress">
      {STEPS.map((s, i) => {
        const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
        return (
          <div key={s.path} className={`stepper-item ${state}`} aria-current={state === "active" ? "step" : undefined}>
            <div className="stepper-bullet">
              {state === "done"
                ? <Icon icon="mdi:check" width={16} height={16} />
                : <Icon icon={s.icon} width={16} height={16} />}
            </div>
            <span className="stepper-label">{t(s.key)}</span>
            {i < STEPS.length - 1 && <span className="stepper-line" aria-hidden="true" />}
          </div>
        );
      })}
    </nav>
  );
}
