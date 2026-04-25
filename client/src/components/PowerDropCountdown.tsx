/*
 * PowerDropCountdown
 * Counts down to activatedAt + 3 days.
 * When the timer hits zero it calls settings.checkExpiry on the server to turn
 * Power Drop off, then invalidates the settings cache so the UI updates immediately.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface PowerDropCountdownProps {
  activatedAt: string; // ISO timestamp
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

const POWER_DROP_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function computeTimeLeft(activatedAt: string): TimeLeft {
  const activated = new Date(activatedAt).getTime();
  if (!activatedAt || isNaN(activated)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: false };
  }
  const deadline = activated + POWER_DROP_WINDOW_MS;
  const diff = deadline - Date.now();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: false,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function PowerDropCountdown({ activatedAt }: PowerDropCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => computeTimeLeft(activatedAt));
  const hasTriggeredExpiry = useRef(false);

  const utils = trpc.useUtils();
  const checkExpiry = trpc.settings.checkExpiry.useMutation({
    onSuccess: () => {
      // Invalidate settings so Home.tsx re-fetches and hides Power Drop UI
      utils.settings.getAll.invalidate();
    },
  });

  // Tick every second
  useEffect(() => {
    if (timeLeft.expired) return;
    const id = setInterval(() => {
      const next = computeTimeLeft(activatedAt);
      setTimeLeft(next);
    }, 1000);
    return () => clearInterval(id);
  }, [activatedAt, timeLeft.expired]);

  // When expired, call the server once to turn Power Drop off
  useEffect(() => {
    if (timeLeft.expired && !hasTriggeredExpiry.current) {
      hasTriggeredExpiry.current = true;
      checkExpiry.mutate();
    }
  }, [timeLeft.expired]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="inline-flex flex-col gap-2"
    >
      {/* Label */}
      <div className="flex items-center gap-1.5">
        <Zap size={11} className="text-[#c73e3a] fill-current" />
        <span className="font-display text-[10px] tracking-[0.25em] text-[#c73e3a] uppercase">
          {timeLeft.expired ? "Order window closed" : "Power Drop closes in"}
        </span>
      </div>

      {timeLeft.expired ? (
        <p className="font-mono-brand text-[13px] text-[#f5f2ec]/50">
          Order window closed.
        </p>
      ) : (
        <div
          className="flex items-stretch gap-0 border border-[#c73e3a]/40 animate-pulse-border"
          style={{ boxShadow: "0 0 16px rgba(199,62,58,0.2), 0 0 32px rgba(199,62,58,0.08)" }}
        >
          {[
            { value: timeLeft.days, label: "DAYS" },
            { value: timeLeft.hours, label: "HRS" },
            { value: timeLeft.minutes, label: "MIN" },
            { value: timeLeft.seconds, label: "SEC" },
          ].map((unit, i) => (
            <div key={unit.label} className="flex items-stretch">
              {i > 0 && (
                <div className="flex items-center px-1 text-[#c73e3a]/60 font-mono-brand text-[20px] font-bold select-none">
                  :
                </div>
              )}
              <div className="flex flex-col items-center justify-center px-3 py-2 min-w-[52px]">
                <span className="font-mono-brand text-[28px] font-bold leading-none text-[#f5f2ec] tabular-nums">
                  {pad(unit.value)}
                </span>
                <span className="font-display text-[8px] tracking-[0.2em] text-[#8a857c] mt-1">
                  {unit.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
