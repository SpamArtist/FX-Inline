export function convertAmountWithSnapshot(amount, sourceCurrency, targetCurrency, snapshot) {
  const sourceRate = snapshot?.rates?.[sourceCurrency];
  const targetRate = snapshot?.rates?.[targetCurrency];

  if (
    typeof sourceRate !== "number" ||
    !Number.isFinite(sourceRate) ||
    sourceRate <= 0
  ) {
    return null;
  }

  if (typeof targetRate !== "number" || !Number.isFinite(targetRate)) {
    return null;
  }

  return (amount * targetRate) / sourceRate;
}
