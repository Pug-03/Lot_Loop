import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";

type Props = {
  /** Value the pad opens with (e.g. an in-progress search). */
  initial?: string;
  /** Number of digits the pad accepts before it stops taking input. */
  maxLength?: number;
  title: string;
  submitLabel: string;
  /** Called with the entered digits when the customer confirms. */
  onSubmit: (value: string) => void;
  onClose: () => void;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Full-screen on-screen numeric keypad for kiosks with no physical keyboard.
 * Manages its own digit buffer so callers just receive the final value on submit.
 */
export default function NumberPad({
  initial = "",
  maxLength = 6,
  title,
  submitLabel,
  onSubmit,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial.slice(0, maxLength));

  const press = (d: string) =>
    setValue((v) => (v.length >= maxLength ? v : v + d));
  const backspace = () => setValue((v) => v.slice(0, -1));
  const clear = () => setValue("");

  const complete = value.length === maxLength;
  const boxes = Array.from({ length: maxLength }, (_, i) => value[i] ?? "");

  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet keypad-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3>{title}</h3>

        <div className="keypad-display" aria-live="polite">
          {boxes.map((d, i) => (
            <div key={i} className={"keypad-box" + (d ? " filled" : "")}>
              {d}
            </div>
          ))}
        </div>

        <div className="keypad-grid">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className="keypad-key"
              onClick={() => press(k)}
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            className="keypad-key action"
            onClick={clear}
            disabled={value.length === 0}
            aria-label={t("common.clear")}
            title={t("common.clear")}
          >
            <Icon icon="mdi:backspace-reverse-outline" width={22} height={22} />
          </button>
          <button type="button" className="keypad-key" onClick={() => press("0")}>
            0
          </button>
          <button
            type="button"
            className="keypad-key action"
            onClick={backspace}
            disabled={value.length === 0}
            aria-label={t("common.backspace")}
            title={t("common.backspace")}
          >
            <Icon icon="mdi:backspace-outline" width={22} height={22} />
          </button>
        </div>

        <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className="btn"
            onClick={() => onSubmit(value)}
            disabled={!complete}
            style={{ marginLeft: 8 }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
