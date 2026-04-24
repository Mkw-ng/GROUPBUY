/*
 * PowerDropCountdown
 * Counts down to the end of the Power Drop pickup window (activatedAt + 14 days).
 * Displays days / hours / minutes / seconds in monospace digits.
 * Shows "Order window closed" when the countdown reaches zero.
 * Only rendered when Power Drop is active.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";

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

function computeTimeLeft(activatedAt: string): TimeLeft {
  const activated = new Date(activatedAt).getTime();
  // Guard against invalid/missing timestamp
  if (!activatedAt || isNaN(activated)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: false };
  }
  // Deadline = activation + 14 days (end of the pickup window)
  const deadline = activated + 14 * 24 * 60 * 60 * 1000;
  const diff = deadline - Date.now();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, expired: false };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function PowerDropCountdown({ activatedAt }: PowerDropCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => computeTimeLeft(activatedAt));

  useEffect(() => {
    if (timeLeft.expired) return;
    const id = setInterval(() => {
      setTimeLeft(computeTimeLeft(activatedAt));
    }, 1000);
    return () => clearInterval(id);
  }, [activatedAt, timeLeft.expired]);

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
