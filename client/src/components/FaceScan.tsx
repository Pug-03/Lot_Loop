import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";

type Phase = "starting" | "searching" | "holding" | "verified" | "error";

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;

// Sampling resolution for the motion/presence analysis (small = cheap).
const S = 64;
// A face has visible structure (eyes, shadows) so the luminance spread inside
// the circle is high; an empty/blank view is flat. Tune for your lighting.
const PRESENCE_STDEV = 16;
// Mean frame-to-frame luminance change that still counts as "holding still".
const STILL_THRESHOLD = 6;
// How long the face must stay still before we accept it.
const REQUIRED_STILL_MS = 1200;

/**
 * Live face-capture for identity verification: turns on the front camera,
 * shows a round frame the face must sit inside, and once the face holds still
 * the ring fills and lights up green — then `onVerified` fires.
 *
 * This handles framing + liveness positioning. To match the face against the
 * ID photo, hand the captured frame to your face-match SDK in `onVerified`.
 */
export default function FaceScan({ onVerified }: { onVerified: () => void }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onVerifiedRef = useRef(onVerified);
  // Holds the live stream so it can be stopped from anywhere (cleanup, retry,
  // or before re-requesting) — we must never leave a track running on the
  // device, since a lingering stream is what makes the next getUserMedia fail.
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [progress, setProgress] = useState(0);
  // Bumping this re-runs the camera-init effect (used by "Try Again").
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);

  useEffect(() => {
    let raf = 0;
    let doneTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    let cancelled = false;

    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    // Precompute which sample pixels fall inside the circular frame.
    const inCircle: boolean[] = [];
    const r = S / 2;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x - r + 0.5;
        const dy = y - r + 0.5;
        inCircle.push(dx * dx + dy * dy <= r * r);
      }
    }

    let prev: Float32Array | null = null;
    let stillMs = 0;
    let lastT = performance.now();

    function loop() {
      const v = videoRef.current;
      if (!v || finished) return;
      const now = performance.now();
      const dt = now - lastT;
      lastT = now;

      if (v.readyState >= 2 && v.videoWidth > 0) {
        // Draw the centered square of the feed into the sample canvas.
        const side = Math.min(v.videoWidth, v.videoHeight);
        const sx = (v.videoWidth - side) / 2;
        const sy = (v.videoHeight - side) / 2;
        ctx.drawImage(v, sx, sy, side, side, 0, 0, S, S);
        const { data } = ctx.getImageData(0, 0, S, S);

        const gray = new Float32Array(S * S);
        let sum = 0;
        let count = 0;
        for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
          const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          gray[p] = lum;
          if (inCircle[p]) {
            sum += lum;
            count++;
          }
        }
        const mean = sum / count;

        // Presence: spread of brightness inside the circle.
        let varSum = 0;
        for (let p = 0; p < gray.length; p++) {
          if (!inCircle[p]) continue;
          const d = gray[p] - mean;
          varSum += d * d;
        }
        const stdev = Math.sqrt(varSum / count);
        const present = stdev > PRESENCE_STDEV;

        // Motion: average change vs the previous frame inside the circle.
        let motion = Infinity;
        if (prev) {
          let mSum = 0;
          for (let p = 0; p < gray.length; p++) {
            if (!inCircle[p]) continue;
            mSum += Math.abs(gray[p] - prev[p]);
          }
          motion = mSum / count;
        }
        prev = gray;

        if (!present) {
          stillMs = 0;
          setProgress(0);
          setPhase("searching");
        } else if (motion < STILL_THRESHOLD) {
          stillMs += dt;
          setPhase("holding");
          setProgress(Math.min(1, stillMs / REQUIRED_STILL_MS));
          if (stillMs >= REQUIRED_STILL_MS) {
            finished = true;
            setProgress(1);
            setPhase("verified");
            doneTimer = setTimeout(() => onVerifiedRef.current(), 900);
            return;
          }
        } else {
          stillMs = 0;
          setProgress(0);
          setPhase("holding");
        }
      }
      raf = requestAnimationFrame(loop);
    }

    function stopStream() {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Open the camera. Always release any active stream first (re-requesting
    // while one is live is a common cause of "Cannot access the camera"). If
    // the front-facing request is rejected, fall back to a permissive
    // constraint set — some devices/browsers don't honor `facingMode`.
    async function openCamera(): Promise<MediaStream> {
      stopStream();
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
      } catch {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
    }

    async function attachAndRun(stream: MediaStream) {
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      try {
        await v.play();
      } catch {
        // Autoplay can reject; the frame loop tolerates a not-yet-playing video.
      }
      if (cancelled) return;
      setPhase("searching");
      lastT = performance.now();
      raf = requestAnimationFrame(loop);
    }

    (async () => {
      setPhase("starting");
      try {
        await attachAndRun(await openCamera());
      } catch {
        // Transient failures (device still releasing, a permission race) are
        // common. Wait briefly, then silently retry once before surfacing the
        // error so the user almost never sees it.
        await new Promise<void>((res) => {
          retryTimer = setTimeout(res, 500);
        });
        if (cancelled) return;
        try {
          await attachAndRun(await openCamera());
        } catch {
          if (!cancelled) setPhase("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      finished = true;
      cancelAnimationFrame(raf);
      if (doneTimer) clearTimeout(doneTimer);
      if (retryTimer) clearTimeout(retryTimer);
      stopStream();
    };
  }, [attempt]);

  // Manual recovery: stop the old stream, give the device ~300ms to release
  // it, then re-run the init effect.
  async function handleTryAgain() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setProgress(0);
    setPhase("starting");
    await new Promise((res) => setTimeout(res, 300));
    setAttempt((a) => a + 1);
  }

  if (phase === "error") {
    return (
      <div className="face-error">
        <Icon icon="mdi:camera-off" width={32} height={32} />
        <span>{t("page1.face_camera_error")}</span>
        <button className="btn" onClick={handleTryAgain}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon icon="mdi:refresh" width={18} height={18} /> {t("page1.face_retry")}
          </span>
        </button>
      </div>
    );
  }

  const status =
    phase === "verified"
      ? t("page1.face_verified")
      : phase === "holding"
      ? t("page1.face_hold")
      : phase === "searching"
      ? t("page1.face_position")
      : t("page1.face_starting");

  return (
    <div className="facescan">
      <div className={`face-frame ${phase}`}>
        <video ref={videoRef} className="face-video" playsInline muted />
        <svg className="face-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="ring-track" cx="50" cy="50" r={RING_R} />
          <circle
            className="ring-progress"
            cx="50"
            cy="50"
            r={RING_R}
            style={{
              strokeDasharray: RING_C,
              strokeDashoffset: RING_C * (1 - progress),
            }}
          />
        </svg>
        {phase === "verified" && (
          <div className="face-check">
            <Icon icon="mdi:check-bold" width={56} height={56} />
          </div>
        )}
      </div>
      <p className={`face-status ${phase}`}>{status}</p>
    </div>
  );
}
