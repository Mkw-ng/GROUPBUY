/** Delivery scheduling rules shared by checkout and server-side validation. */
export const DELIVERY_WEEKDAYS = [3, 6] as const; // Wednesday, Saturday
export const DELIVERY_DAYS_LABEL = "Wednesdays & Saturdays";
export const MIN_LEAD_DAYS = 2;

function atLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function earliestOrderDate(now: Date): Date {
  const earliest = atLocalMidnight(now);
  earliest.setDate(earliest.getDate() + MIN_LEAD_DAYS);
  return earliest;
}

export function isDeliveryWeekday(date: Date): boolean {
  return DELIVERY_WEEKDAYS.includes(date.getDay() as (typeof DELIVERY_WEEKDAYS)[number]);
}

export function earliestDeliveryDate(now: Date): Date {
  const earliest = earliestOrderDate(now);
  while (!isDeliveryWeekday(earliest)) {
    earliest.setDate(earliest.getDate() + 1);
  }
  return earliest;
}

export function isDateAllowed(date: Date, location: string, now: Date): boolean {
  const candidate = atLocalMidnight(date);
  if (candidate < earliestOrderDate(now)) return false;
  return location !== "delivery" || isDeliveryWeekday(candidate);
}

export function isDeliveryDateLabel(label: string): boolean {
  return /^(Wednesday|Saturday),/.test(label);
}
