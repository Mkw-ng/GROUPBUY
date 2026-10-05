import { describe, expect, it } from "vitest";
import { DELIVERY_ZONE_FEE, DELIVERY_ZONE_FEE_LABEL } from "../shared/deliveryPricing";

describe("delivery zone pricing", () => {
  it("uses one flat $12.50 fee for every delivery zone", () => {
    expect(DELIVERY_ZONE_FEE).toBe(12.5);
    expect(DELIVERY_ZONE_FEE_LABEL).toBe("$12.50");
  });
});
