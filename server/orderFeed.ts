import { timingSafeEqual } from "node:crypto";

type FeedRow = {
  id?: unknown;
  invoiceNumber?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  status?: unknown;
  archived?: unknown;
  phone?: unknown;
  pickupDate?: unknown;
  location?: unknown;
  deliveryAddress?: unknown;
  specialInstructions?: unknown;
  deliveryCharge?: unknown;
  items?: unknown;
};

type FeedItem = {
  name: string;
  cut: string;
  qty: number;
  unit: string;
  price: number;
  note: string | null;
  finalWeightKg: string | null;
};

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asPrice(value: unknown): number {
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toValidDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function toIso(value: unknown): string {
  const date = toValidDate(value);
  return date ? date.toISOString() : "";
}

function toMelbourneLabel(value: unknown): string {
  const date = toValidDate(value);
  if (!date) return "";

  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")} ${part("dayPeriod").toLowerCase()}`;
}

function locationLabel(location: string): string {
  const normalized = location.toLowerCase();
  if (normalized === "cranbourne") return "Cranbourne";
  if (normalized === "clayton") return "Clayton";
  if (normalized === "delivery") return "Delivery";
  return location;
}

function parseItems(raw: unknown): { items: FeedItem[]; itemsError?: "unreadable items" } {
  let parsed: unknown;
  try {
    if (typeof raw !== "string") return { items: [], itemsError: "unreadable items" };
    parsed = JSON.parse(raw);
  } catch {
    return { items: [], itemsError: "unreadable items" };
  }

  if (!Array.isArray(parsed)) return { items: [], itemsError: "unreadable items" };

  const items: FeedItem[] = [];
  let hasUnreadableItem = false;
  for (const item of parsed) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      hasUnreadableItem = true;
      continue;
    }

    const rawItem = item as Record<string, unknown>;
    items.push({
      name: asString(rawItem.name),
      cut: asString(rawItem.cut),
      qty: asFiniteNumber(rawItem.qty),
      unit: asString(rawItem.unit).replace(/^\s*\/\s*/, ""),
      price: asPrice(rawItem.price),
      note: asNullableString(rawItem.note),
      finalWeightKg: asNullableString(rawItem.finalWeightKg),
    });
  }

  return hasUnreadableItem ? { items, itemsError: "unreadable items" } : { items };
}

/** Converts a stored checkout date label into an ISO calendar date. */
export function parsePickupDateLabel(label: string): string | null {
  try {
    const match = /^([A-Za-z]+), (\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(label);
    if (!match) return null;

    const day = Number(match[2]);
    const month = MONTH_INDEX[match[3].toLowerCase()];
    const year = Number(match[4]);
    if (!Number.isInteger(day) || month === undefined || !Number.isInteger(year)) return null;

    const candidate = new Date(Date.UTC(year, month, day));
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month ||
      candidate.getUTCDate() !== day
    ) {
      return null;
    }

    return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

/** Formats one database order row for the external, read-only casual-order feed. */
export function formatFeedOrder(row: FeedRow) {
  try {
    const id = asFiniteNumber(row?.id);
    const parsedItems = parseItems(row?.items);
    const pickupDateLabel = asString(row?.pickupDate);
    const location = asString(row?.location);
    const specialInstructions = asString(row?.specialInstructions).trim();
    const approxTotal = parsedItems.items.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2);

    const result = {
      id,
      invoiceNumber: typeof row?.invoiceNumber === "string"
        ? row.invoiceNumber
        : `GB-${String(id).padStart(5, "0")}`,
      createdAt: toIso(row?.createdAt),
      updatedAt: toIso(row?.updatedAt),
      createdAtMelbourne: toMelbourneLabel(row?.createdAt),
      status: asString(row?.status),
      archived: row?.archived === true,
      phone: asString(row?.phone),
      pickupDateLabel,
      pickupDate: parsePickupDateLabel(pickupDateLabel),
      location,
      locationLabel: locationLabel(location),
      deliveryAddress: asNullableString(row?.deliveryAddress),
      specialInstructions: specialInstructions || null,
      deliveryCharge: asNullableString(row?.deliveryCharge),
      items: parsedItems.items,
      approxTotal,
    };

    return parsedItems.itemsError ? { ...result, itemsError: parsedItems.itemsError } : result;
  } catch {
    return {
      id: 0,
      invoiceNumber: "GB-00000",
      createdAt: "",
      updatedAt: "",
      createdAtMelbourne: "",
      status: "",
      archived: false,
      phone: "",
      pickupDateLabel: "",
      pickupDate: null,
      location: "",
      locationLabel: "",
      deliveryAddress: null,
      specialInstructions: null,
      deliveryCharge: null,
      items: [],
      approxTotal: "0.00",
      itemsError: "unreadable items" as const,
    };
  }
}

/** Compares a supplied order-feed key without leaking matching-prefix information. */
export function isValidFeedKey(provided: string | undefined, expected: string | undefined): boolean {
  try {
    if (!provided || !expected) return false;
    const actual = Buffer.from(provided, "utf8");
    const required = Buffer.from(expected, "utf8");
    if (actual.length !== required.length) return false;
    return timingSafeEqual(actual, required);
  } catch {
    return false;
  }
}
