import { describe, expect, it } from "vitest";
import {
  FEATURED_DEALS_CATEGORY,
  LIMITED_OFFER_CATEGORY,
  getStorefrontDefaultCategory,
} from "../shared/storefrontCategory";

describe("getStorefrontDefaultCategory", () => {
  it("keeps Limited Offer as the default when it has sellable products", () => {
    expect(getStorefrontDefaultCategory(new Set([LIMITED_OFFER_CATEGORY, FEATURED_DEALS_CATEGORY]))).toBe(LIMITED_OFFER_CATEGORY);
  });

  it("falls back to Featured Deals when Limited Offer has no sellable products", () => {
    expect(getStorefrontDefaultCategory(new Set([FEATURED_DEALS_CATEGORY]))).toBe(FEATURED_DEALS_CATEGORY);
  });

  it("retains Limited Offer when neither default category is sellable", () => {
    expect(getStorefrontDefaultCategory(new Set(["beef"]))).toBe(LIMITED_OFFER_CATEGORY);
  });
});
