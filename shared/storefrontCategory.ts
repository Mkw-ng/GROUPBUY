export const LIMITED_OFFER_CATEGORY = "limited-offer";
export const FEATURED_DEALS_CATEGORY = "featured-deals";

/** Keeps Limited Offer as the default unless it has no sellable products. */
export function getStorefrontDefaultCategory(sellableCategories: ReadonlySet<string>): string {
  return sellableCategories.has(LIMITED_OFFER_CATEGORY)
    ? LIMITED_OFFER_CATEGORY
    : sellableCategories.has(FEATURED_DEALS_CATEGORY)
      ? FEATURED_DEALS_CATEGORY
      : LIMITED_OFFER_CATEGORY;
}
