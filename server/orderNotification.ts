export type NewOrderNotificationInput = {
  invoiceNumber: string;
  phone: string;
  pickupDate: string;
  location: string;
  deliveryAddress: string | null;
  isPowerDrop: boolean;
  items: Array<{
    name: string;
    cut: string;
    qty: number;
    price: string;
    unit: string;
    note?: string;
  }>;
};

const CONTENT_MAX_LENGTH = 19_000;
const TRUNCATION_SUFFIX = "… (truncated, see admin)";

function formatLocation(location: string, deliveryAddress: string | null): string {
  if (location === "cranbourne") return "Cranbourne";
  if (location === "clayton") return "Clayton";
  if (location === "delivery") return `Delivery — ${deliveryAddress ?? ""}`;
  return location;
}

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(qty);
}

function truncateContent(content: string): string {
  if (content.length <= CONTENT_MAX_LENGTH) return content;
  return `${content.slice(0, CONTENT_MAX_LENGTH - TRUNCATION_SUFFIX.length)}${TRUNCATION_SUFFIX}`;
}

export function buildNewOrderNotification(
  input: NewOrderNotificationInput
): { title: string; content: string } {
  const total = input.items.reduce(
    (sum, item) => sum + (parseFloat(item.price) || 0) * item.qty,
    0
  );

  const itemLines = input.items.flatMap((item) => {
    const cleanUnit = item.unit.replace(/^\/\s*/, "");
    const cut = item.cut ? ` (${item.cut})` : "";
    const itemLine = `Items: ${formatQty(item.qty)} × ${item.name}${cut} — $${item.price} / ${cleanUnit}`;
    return item.note?.trim()
      ? [itemLine, `  ↳ Request: ${item.note.trim()}`]
      : [itemLine];
  });

  const content = [
    `Type: ${input.isPowerDrop ? "Power Drop order" : "Casual order"}`,
    `Phone: ${input.phone}`,
    `Pick up date: ${input.pickupDate}`,
    `Location: ${formatLocation(input.location, input.deliveryAddress)}`,
    ...itemLines,
    `Approx total: $${total.toFixed(2)} (before final weights and delivery)`,
    "View in admin: https://mitchellsgroupbuy.com/admin/orders",
  ].join("\n");

  return {
    title: `New order ${input.invoiceNumber} — ${input.phone}`,
    content: truncateContent(content),
  };
}
