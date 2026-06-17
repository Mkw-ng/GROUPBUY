/**
 * useSavedOrderDetails
 * Persists a customer's WhatsApp phone number and preferred pickup location
 * to localStorage so they auto-fill on future visits.
 */
import { useState, useEffect } from "react";

const STORAGE_KEY = "groupbuy_order_details";

export type SavedPickupLocation =
  | "cranbourne"
  | "clayton"
  | "delivery";

export interface SavedOrderDetails {
  phone: string;
  location: SavedPickupLocation;
  deliveryAddress?: string;
}

const VALID_LOCATIONS: SavedPickupLocation[] = [
  "cranbourne",
  "clayton",
  "delivery",
];

function readStorage(): SavedOrderDetails | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedOrderDetails>;
    if (
      typeof parsed.phone === "string" &&
      VALID_LOCATIONS.includes(parsed.location as SavedPickupLocation)
    ) {
      return {
        phone: parsed.phone,
        location: parsed.location as SavedPickupLocation,
        deliveryAddress: typeof parsed.deliveryAddress === "string" ? parsed.deliveryAddress : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeStorage(details: SavedOrderDetails): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(details));
  } catch {
    // storage unavailable — silently ignore
  }
}

function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable — silently ignore
  }
}

export function useSavedOrderDetails() {
  const [saved, setSaved] = useState<SavedOrderDetails | null>(null);

  // Read once on mount (client-side only)
  useEffect(() => {
    setSaved(readStorage());
  }, []);

  function save(details: SavedOrderDetails) {
    writeStorage(details);
    setSaved(details);
  }

  function clear() {
    clearStorage();
    setSaved(null);
  }

  return { saved, save, clear };
}
