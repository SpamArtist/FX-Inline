export function clearTimer(timer: number | null): number | null {
  if (timer !== null) {
    window.clearTimeout(timer);
  }

  return null;
}
