export function nowMs(): number {
  return Date.now();
}

export function hoursFromNow(hours: number): number {
  return nowMs() + hours * 60 * 60 * 1000;
}
