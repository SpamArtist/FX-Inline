export function nowMs() {
  return Date.now();
}

export function hoursFromNow(hours) {
  return nowMs() + hours * 60 * 60 * 1000;
}
