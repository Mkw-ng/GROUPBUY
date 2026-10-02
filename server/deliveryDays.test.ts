process.env.TZ = "Australia/Melbourne";

import { describe, expect, it } from "vitest";
import {
  earliestDeliveryDate,
  earliestOrderDate,
  isDateAllowed,
  isDeliveryDateLabel,
} from "@shared/deliveryDays";

describe("delivery scheduling rules", () => {
  it.each([
    [new Date(2026, 9, 12, 9, 0), new Date(2026, 9, 14)],
    [new Date(2026, 9, 13, 9, 0), new Date(2026, 9, 17)],
    [new Date(2026, 9, 13, 23, 30), new Date(2026, 9, 17)],
    [new Date(2026, 9, 14, 9, 0), new Date(2026, 9, 17)],
    [new Date(2026, 9, 15, 9, 0), new Date(2026, 9, 17)],
    [new Date(2026, 9, 16, 9, 0), new Date(2026, 9, 21)],
    [new Date(2026, 9, 17, 9, 0), new Date(2026, 9, 21)],
    [new Date(2026, 9, 18, 9, 0), new Date(2026, 9, 21)],
  ])("finds the earliest delivery date from %s", (now, expected) => {
    expect(earliestDeliveryDate(now)).toEqual(expected);
  });

  it("uses calendar days across daylight-saving changes", () => {
    expect(earliestOrderDate(new Date(2026, 9, 3, 22, 0))).toEqual(new Date(2026, 9, 5));
    expect(earliestDeliveryDate(new Date(2026, 9, 3, 22, 0))).toEqual(new Date(2026, 9, 7));
    expect(earliestOrderDate(new Date(2026, 3, 4, 22, 0))).toEqual(new Date(2026, 3, 6));
  });

  it("allows only valid delivery and pickup dates", () => {
    const lateTuesday = new Date(2026, 9, 13, 23, 59);
    expect(isDateAllowed(new Date(2026, 9, 14), "delivery", lateTuesday)).toBe(false);
    expect(isDateAllowed(new Date(2026, 9, 17), "delivery", lateTuesday)).toBe(true);
    expect(isDateAllowed(new Date(2026, 9, 21), "delivery", lateTuesday)).toBe(true);
    expect(isDateAllowed(new Date(2026, 9, 15), "delivery", lateTuesday)).toBe(false);
    expect(isDateAllowed(new Date(2026, 9, 15), "cranbourne", lateTuesday)).toBe(true);

    const monday = new Date(2026, 9, 12, 9, 0);
    expect(isDateAllowed(new Date(2026, 9, 13), "delivery", monday)).toBe(false);
    expect(isDateAllowed(new Date(2026, 9, 14), "delivery", monday)).toBe(true);
  });

  it("recognises delivery weekday labels", () => {
    expect(isDeliveryDateLabel("Wednesday, 14 October 2026")).toBe(true);
    expect(isDeliveryDateLabel("Saturday, 17 October 2026")).toBe(true);
    expect(isDeliveryDateLabel("Thursday, 15 October 2026")).toBe(false);
    expect(isDeliveryDateLabel("")).toBe(false);
  });
});
