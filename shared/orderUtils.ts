export interface OrderLineItem {
  price: string;
  qty: number;
  unit: string;
  finalWeightKg?: string;
}

export function calcLineItemTotal(item: OrderLineItem): number {
  const price = parseFloat(item.price) || 0;
  const isKg = (item.unit || "").toLowerCase().includes("kg");
  const weight = parseFloat(item.finalWeightKg || "") || 0;
  if (isKg && weight > 0) return price * weight;
  if (isKg) return price * item.qty;
  return price * item.qty;
}

export function calcOrderTotal(items: OrderLineItem[], deliveryCharge?: string | null): number {
  const subtotal = items.reduce((sum, item) => sum + calcLineItemTotal(item), 0);
  return subtotal + (parseFloat(deliveryCharge ?? "0") || 0);
}
