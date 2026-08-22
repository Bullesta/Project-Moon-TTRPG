export function poolFloor(pool) {
  return pool === "sp" ? -Infinity : 0;
}

export function clampPoolValue(pool, value, max) {
  const current = Number(value);
  if (!Number.isFinite(current)) return 0;

  const maximum = Number(max);
  const minimum = poolFloor(pool);

  return Math.max(minimum, Math.min(
    current,
    Number.isFinite(maximum) ? maximum : current
  ));
}

export function crossesDepletion(before, after) {
  const previous = Number(before);
  const current = Number(after);

  return (
    Number.isFinite(previous) &&
    Number.isFinite(current) &&
    previous > 0 &&
    current <= 0
  );
}
