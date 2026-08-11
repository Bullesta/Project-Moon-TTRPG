export function isPendingStatus(item) {
  return item?.type === "status" && !!item.system?.pending;
}

export function normalizeArrival(arrival) {
  const a = String(arrival ?? "").toLowerCase().trim();
  if (a === "round" || a === "turn") return a;
  return "round";
}
