/**
 * Achievement badge definitions for the GroupBuy loyalty system.
 * Badges are computed server-side from customer stats and stored as a JSON
 * array of badge IDs in customers.badges.
 */

export interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  description: string;
  /** Rarity tier — affects visual treatment on the stats card */
  rarity: "common" | "rare" | "epic" | "legendary";
}

export const ALL_BADGES: BadgeDef[] = [
  // ─── First-time milestones ────────────────────────────────────────────────
  {
    id: "first_drop",
    emoji: "🥩",
    name: "First Drop",
    description: "Completed your very first GroupBuy order",
    rarity: "common",
  },
  {
    id: "welcome_to_the_family",
    emoji: "🤝",
    name: "Welcome to the Family",
    description: "Joined the GroupBuy community",
    rarity: "common",
  },

  // ─── Order count milestones ───────────────────────────────────────────────
  {
    id: "five_drops",
    emoji: "🖐️",
    name: "Five-Timer",
    description: "Placed 5 orders",
    rarity: "common",
  },
  {
    id: "ten_drops",
    emoji: "🔟",
    name: "Double Digits",
    description: "Placed 10 orders",
    rarity: "rare",
  },
  {
    id: "twenty_five_drops",
    emoji: "🏅",
    name: "Quarter Century",
    description: "Placed 25 orders",
    rarity: "epic",
  },
  {
    id: "fifty_drops",
    emoji: "🏆",
    name: "Half-Century",
    description: "Placed 50 orders",
    rarity: "legendary",
  },

  // ─── Streak badges ────────────────────────────────────────────────────────
  {
    id: "on_fire",
    emoji: "🔥",
    name: "On Fire",
    description: "Ordered in 3 consecutive drops",
    rarity: "common",
  },
  {
    id: "unstoppable",
    emoji: "⚡",
    name: "Unstoppable",
    description: "Ordered in 5 consecutive drops",
    rarity: "rare",
  },
  {
    id: "iron_streak",
    emoji: "🦾",
    name: "Iron Streak",
    description: "Ordered in 10 consecutive drops",
    rarity: "epic",
  },

  // ─── Spend milestones ─────────────────────────────────────────────────────
  {
    id: "century_club",
    emoji: "💯",
    name: "Century Club",
    description: "Spent over $100 in total",
    rarity: "common",
  },
  {
    id: "five_hundred_club",
    emoji: "💰",
    name: "Five Hundred Club",
    description: "Spent over $500 in total",
    rarity: "rare",
  },
  {
    id: "grand_club",
    emoji: "💎",
    name: "Grand Club",
    description: "Spent over $1,000 in total",
    rarity: "epic",
  },
  {
    id: "high_roller",
    emoji: "🎰",
    name: "High Roller",
    description: "Spent over $5,000 in total",
    rarity: "legendary",
  },

  // ─── Big order badges ─────────────────────────────────────────────────────
  {
    id: "big_order",
    emoji: "📦",
    name: "Big Order",
    description: "Placed a single order over $200",
    rarity: "rare",
  },
  {
    id: "mega_haul",
    emoji: "🚛",
    name: "Mega Haul",
    description: "Placed a single order over $500",
    rarity: "epic",
  },

  // ─── Power Drop badges ────────────────────────────────────────────────────
  {
    id: "power_player",
    emoji: "⚡",
    name: "Power Player",
    description: "Attended 3 Power Drop events",
    rarity: "rare",
  },
  {
    id: "power_addict",
    emoji: "🌩️",
    name: "Power Addict",
    description: "Attended 10 Power Drop events",
    rarity: "epic",
  },

  // ─── Weight / kg badges ───────────────────────────────────────────────────
  {
    id: "ten_kg",
    emoji: "⚖️",
    name: "10kg Club",
    description: "Ordered over 10 kg in total",
    rarity: "common",
  },
  {
    id: "fifty_kg",
    emoji: "🏋️",
    name: "50kg Beast",
    description: "Ordered over 50 kg in total",
    rarity: "rare",
  },
  {
    id: "hundred_kg",
    emoji: "🐄",
    name: "Whole Cow",
    description: "Ordered over 100 kg in total",
    rarity: "epic",
  },

  // ─── Category loyalty badges ──────────────────────────────────────────────
  {
    id: "beef_loyalist",
    emoji: "🥩",
    name: "Beef Loyalist",
    description: "Beef is your most ordered category",
    rarity: "common",
  },
  {
    id: "lamb_lover",
    emoji: "🐑",
    name: "Lamb Lover",
    description: "Lamb is your most ordered category",
    rarity: "common",
  },
  {
    id: "pork_king",
    emoji: "🐷",
    name: "Pork King",
    description: "Pork is your most ordered category",
    rarity: "common",
  },
  {
    id: "seafood_fanatic",
    emoji: "🦐",
    name: "Seafood Fanatic",
    description: "Seafood is your most ordered category",
    rarity: "common",
  },
  {
    id: "m3atfr3ak",
    emoji: "🤘",
    name: "M3ATFR3AK",
    description: "Ordered from the M3ATFR3AK category",
    rarity: "epic",
  },

  // ─── Longevity / tenure badges ────────────────────────────────────────────
  {
    id: "three_months",
    emoji: "📅",
    name: "3-Month Member",
    description: "Been ordering for 3+ months",
    rarity: "common",
  },
  {
    id: "six_months",
    emoji: "🗓️",
    name: "6-Month Member",
    description: "Been ordering for 6+ months",
    rarity: "rare",
  },
  {
    id: "one_year",
    emoji: "🎂",
    name: "1-Year Anniversary",
    description: "Been ordering for over a year",
    rarity: "epic",
  },

  // ─── Special / fun badges ─────────────────────────────────────────────────
  {
    id: "savings_king",
    emoji: "🤑",
    name: "Savings King",
    description: "Saved over $100 through Power Drop pricing",
    rarity: "rare",
  },
  {
    id: "og_member",
    emoji: "👑",
    name: "OG Member",
    description: "Reached the OG loyalty tier",
    rarity: "epic",
  },
  {
    id: "legend",
    emoji: "🌟",
    name: "Legend",
    description: "Reached the Legend loyalty tier",
    rarity: "legendary",
  },
];

/** Map for O(1) lookup by id */
export const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(
  ALL_BADGES.map((b) => [b.id, b])
);

/** Rarity sort order for display */
export const RARITY_ORDER: Record<BadgeDef["rarity"], number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  common: 3,
};
