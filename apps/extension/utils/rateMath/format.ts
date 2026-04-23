export function formatConvertedAmount(amount: number, precision = 4): string {
  return amount.toFixed(precision);
}
