import { cleanNumber } from "./numbers";

/**
 * Canonical price/amount display format across the platform.
 * Output: thousands comma, up to 2 decimal places, no trailing zeros.
 * e.g. 350 → "350", 350.1 → "350.1", 350.01 → "350.01", 12346.09 → "12,346.09".
 *
 * @param value - Number or string (e.g. 12346.09, "12346.09", "$12,346.09")
 * @returns Formatted string or "0" for invalid input
 */
export function formatPriceDisplay(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(String(value).replace(/[^0-9.-]/g, "")) : value;
  if (!Number.isFinite(n)) return "0";
  const clean = cleanNumber(n, 2);
  return clean.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * @deprecated Use formatPriceDisplay for consistency. Same behavior.
 * Format price: thousands comma, up to 2 decimals, no trailing zeros.
 */
export function formatPrice(priceStr: string): string {
  return formatPriceDisplay(priceStr);
}
