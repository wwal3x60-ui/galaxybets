/**
 * Decimal / number utilities to avoid floating-point display noise
 * (e.g. 0.0014000000000000002 → 0.0014).
 * Use these whenever you display or persist numeric values.
 */

const DEFAULT_MAX_DECIMALS = 8;

/**
 * Round a number to a fixed number of decimal places and return a clean number.
 * Avoids values like 0.0014000000000000002 by rounding to maxDecimals.
 *
 * @param value - Number that may have floating-point noise
 * @param maxDecimals - Max decimal places (default 8)
 * @returns Rounded number safe for display and comparison
 */
export function cleanNumber(value: number, maxDecimals: number = DEFAULT_MAX_DECIMALS): number {
  if (!Number.isFinite(value)) return 0;
  const d = Math.min(Math.max(0, Math.floor(maxDecimals)), 20);
  return parseFloat(value.toFixed(d));
}

/**
 * Format a number or numeric string for display with a fixed number of decimals.
 * Uses cleanNumber internally so the result never has floating-point noise.
 *
 * @param value - Number or string (e.g. "0.0014", 0.0014000000000000002)
 * @param decimals - Number of decimal places in the output
 * @returns Formatted string (e.g. "0.00", "1.40", "0.0014")
 */
export function formatDecimal(value: number | string, decimals: number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return (0).toFixed(decimals);
  return cleanNumber(n, decimals).toFixed(decimals);
}

/**
 * Format as currency (2 decimals). Returns string without $ so caller can add it.
 * @param value - Number or string
 * @returns e.g. "12.34"
 */
export function formatCurrency(value: number | string): string {
  return formatDecimal(value, 2);
}

/**
 * Format as percent with given decimal places (default 2).
 * @param value - Number in 0–1 or 0–100 (we treat as 0–100 if >= 1 or value > 1)
 * @param decimals - Decimal places
 * @param asFraction - If true, value is 0–1; if false, value is 0–100
 */
export function formatPercent(
  value: number | string,
  decimals: number = 2,
  asFraction: boolean = false
): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return (0).toFixed(decimals) + "%";
  const scaled = asFraction ? n * 100 : n;
  return formatDecimal(scaled, decimals) + "%";
}
