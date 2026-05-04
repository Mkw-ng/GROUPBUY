/**
 * BadgeGrid — displays earned and locked achievement badges.
 * Earned badges are bright with rarity glow; locked badges are greyed with a lock overlay.
 * Designed to fit the "Butcher's Receipt" aesthetic (cream/ink palette).
 */
import { useState } from "react";
import type { BadgeDef } from "@shared/badges";

interface BadgeWithEarned extends BadgeDef {
  earned: boolean;
}

interface BadgeGridProps {
  badges: BadgeWithEarned[];
  earnedCount: number;
  totalCount: number;
}

const RARITY_STYLES: Record<BadgeDef["rarity"], { ring: string; glow: string; label: string; labelColor: string }> = {
  legendary: {
    ring: "ring-2 ring-yellow-400",
    glow: "shadow-[0_0_12px_rgba(250,204,21,0.5)]",
    label: "LEGENDARY",
    labelColor: "text-yellow-600",
  },
  epic: {
    ring: "ring-2 ring-purple-400",
    glow: "shadow-[0_0_10px_rgba(192,132,252,0.4)]",
    label: "EPIC",
    labelColor: "text-purple-600",
  },
  rare: {
    ring: "ring-2 ring-blue-400",
    glow: "shadow-[0_0_8px_rgba(96,165,250,0.35)]",
    label: "RARE",
    labelColor: "text-blue-600",
  },
  common: {
    ring: "ring-1 ring-[#2b2b2b]/20",
    glow: "",
    label: "COMMON",
    labelColor: "text-[#8a857c]",
  },
};

function BadgeCard({ badge }: { badge: BadgeWithEarned }) {
  const [hovered, setHovered] = useState(false);
  const style = RARITY_STYLES[badge.rarity];

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      tabIndex={0}
      role="button"
      aria-label={`${badge.name}: ${badge.description}${badge.earned ? " (earned)" : " (locked)"}`}
    >
      {/* Badge circle */}
      <div
        className={`
          relative w-14 h-14 rounded-full flex items-center justify-center text-2xl
          transition-all duration-200
          ${badge.earned
            ? `bg-white ${style.ring} ${style.glow}`
            : "bg-[#f0ece6] ring-1 ring-[#2b2b2b]/10 grayscale opacity-40"
          }
        `}
      >
        <span className={badge.earned ? "" : "opacity-50"}>{badge.emoji}</span>

        {/* Lock overlay for unearned badges */}
        {!badge.earned && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[#8a857c] absolute bottom-1 right-1"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        )}

        {/* Rarity sparkle for legendary */}
        {badge.earned && badge.rarity === "legendary" && (
          <span className="absolute -top-1 -right-1 text-[10px]">✨</span>
        )}
      </div>

      {/* Badge name */}
      <p
        className={`
          font-mono text-[9px] text-center mt-1.5 leading-tight max-w-[56px]
          ${badge.earned ? "text-[#2b2b2b] font-semibold" : "text-[#8a857c]"}
        `}
      >
        {badge.name}
      </p>

      {/* Tooltip on hover */}
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44 pointer-events-none">
          <div className="bg-[#2b2b2b] text-[#faf8f5] rounded px-3 py-2 shadow-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">{badge.emoji}</span>
              <span className="font-mono text-[11px] font-bold">{badge.name}</span>
            </div>
            <p className="font-mono text-[10px] text-[#c8c4bc] leading-tight">
              {badge.description}
            </p>
            <p className={`font-mono text-[9px] mt-1 font-bold ${style.labelColor.replace("text-", "text-").replace("600", "400")}`}>
              {style.label}
            </p>
            {!badge.earned && (
              <p className="font-mono text-[9px] text-[#8a857c] mt-0.5 italic">🔒 Not yet earned</p>
            )}
          </div>
          {/* Tooltip arrow */}
          <div className="flex justify-center">
            <div className="w-2 h-2 bg-[#2b2b2b] rotate-45 -mt-1" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function BadgeGrid({ badges, earnedCount, totalCount }: BadgeGridProps) {
  const [showAll, setShowAll] = useState(false);

  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  // Show earned first, then a few locked ones as teasers
  const visibleLocked = showAll ? locked : locked.slice(0, Math.min(6, locked.length));
  const displayed = [...earned, ...visibleLocked];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[10px] text-[#8a857c] tracking-widest">ACHIEVEMENTS</p>
        <span className="font-mono text-[10px] text-[#2b2b2b] font-bold">
          {earnedCount} / {totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-[#2b2b2b]/10 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-[#c73e3a] rounded-full transition-all duration-700"
          style={{ width: `${totalCount > 0 ? (earnedCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      {/* Badge grid */}
      {earned.length === 0 ? (
        <div className="text-center py-4">
          <p className="font-mono text-[11px] text-[#8a857c]">
            No badges yet — archive your first order to unlock achievements!
          </p>
        </div>
      ) : (
        <>
          {/* Earned section */}
          <div className="mb-3">
            <p className="font-mono text-[9px] text-[#c73e3a] tracking-widest mb-2">
              ✓ EARNED ({earned.length})
            </p>
            <div className="flex flex-wrap gap-3">
              {earned.map((b) => (
                <BadgeCard key={b.id} badge={b} />
              ))}
            </div>
          </div>

          {/* Locked section */}
          {locked.length > 0 && (
            <div>
              <p className="font-mono text-[9px] text-[#8a857c] tracking-widest mb-2">
                🔒 LOCKED ({locked.length})
              </p>
              <div className="flex flex-wrap gap-3">
                {visibleLocked.map((b) => (
                  <BadgeCard key={b.id} badge={b} />
                ))}
              </div>
              {!showAll && locked.length > 6 && (
                <button
                  onClick={() => setShowAll(true)}
                  className="mt-3 font-mono text-[10px] text-[#8a857c] hover:text-[#2b2b2b] transition-colors underline underline-offset-2"
                >
                  Show {locked.length - 6} more locked badges
                </button>
              )}
              {showAll && locked.length > 6 && (
                <button
                  onClick={() => setShowAll(false)}
                  className="mt-3 font-mono text-[10px] text-[#8a857c] hover:text-[#2b2b2b] transition-colors underline underline-offset-2"
                >
                  Show fewer
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
