/**
 * Effective Visibility Helper
 *
 * A product's EFFECTIVE visibility is the more restrictive of its own
 * visibility and its category's visibility:
 *
 *   category power_drop_only → product is treated as power_drop_only
 *   category regular_only    → product is treated as regular_only
 *   category always          → product's own visibility applies unchanged
 *
 * Used by:
 *   - server/routers.ts  (orders.create enforcement)
 *   - client/src/components/DealsSection.tsx (public site pre-filter)
 */

export type VisibilityMode = "regular_only" | "always" | "power_drop_only";

/**
 * Compute the effective visibility of a product given its own visibility
 * and the visibility of the category it belongs to.
 */
export function effectiveVisibility(
  productVisibility: VisibilityMode,
  categoryVisibility: VisibilityMode
): VisibilityMode {
  // Category overrides take priority
  if (categoryVisibility === "power_drop_only") return "power_drop_only";
  if (categoryVisibility === "regular_only") return "regular_only";
  // category is "always" — defer to the product's own setting
  return productVisibility;
}

/**
 * Returns true if a product (with the given effective visibility) is
 * orderable/visible in the current Power Drop mode.
 *
 * @param effectiveVis  - result of effectiveVisibility()
 * @param isPowerDrop   - whether Power Drop is currently active
 */
export function isVisibleInMode(
  effectiveVis: VisibilityMode,
  isPowerDrop: boolean
): boolean {
  if (effectiveVis === "always") return true;
  if (effectiveVis === "power_drop_only") return isPowerDrop;
  // regular_only
  return !isPowerDrop;
}
