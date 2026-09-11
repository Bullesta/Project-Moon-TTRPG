/**
 * Max that would drop a die below d1 becomes a Power penalty instead.
 */
export function applyDiceMaxFloor(baseSides, maxDelta = 0) {
  const base = Math.max(1, Math.round(Number(baseSides) || 1));
  const delta = Math.round(Number(maxDelta) || 0);
  let sides = base + delta;
  let powerAdjust = 0;
  if (sides < 1) {
    powerAdjust = sides - 1;
    sides = 1;
  }
  return { sides, powerAdjust };
}

/** `NdX+P` only. Keep/drop and other Foundry syntax return null. */
export function parseSimpleDiceFormula(formula) {
  const raw = String(formula ?? "").trim();
  const m = raw.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  return {
    count: Number(m[1] || 1) || 1,
    sides: Number(m[2]) || 1,
    power: Number(m[3] || 0) || 0,
  };
}

export function formatDiceFormula(count, sides, power) {
  const n = Math.max(1, Math.round(Number(count) || 1));
  const s = Math.max(1, Math.round(Number(sides) || 1));
  const p = Math.round(Number(power) || 0);
  if (!p) return `${n}d${s}`;
  return `${n}d${s}${p > 0 ? `+${p}` : `${p}`}`;
}

/**
 * `deal 1d10 per N` becomes one `Nd10` roll. Flat Power is not multiplied.
 */
export function expandSimpleDiceByMultiplier(formula, times) {
  const n = Math.max(0, Math.round(Number(times) || 0));
  if (n <= 0) return "0";
  const parsed = parseSimpleDiceFormula(formula);
  if (!parsed) return null;
  return formatDiceFormula(parsed.count * n, parsed.sides, parsed.power);
}

/** Max changes die size; Power stays flat. */
export function resolveDiceBonuses(baseFormula, bonuses = {}) {
  const power = Math.round(Number(bonuses.power) || 0);
  const max = Math.round(Number(bonuses.max) || 0);
  const parsed = parseSimpleDiceFormula(baseFormula);
  if (!parsed) {
    if (max) {
      console.warn(
        `[EasyEffects] Cannot apply dice max (${max}) to non-simple formula '${baseFormula}'; power only.`
      );
    }
    const formula = !power
      ? String(baseFormula ?? "")
      : `${baseFormula}${power > 0 ? `+${power}` : `${power}`}`;
    return {
      formula,
      sides: parsed?.sides ?? 0,
      power: (parsed?.power ?? 0) + power,
      powerAdjust: 0,
      maxDelta: max,
    };
  }

  const { sides, powerAdjust } = applyDiceMaxFloor(parsed.sides, max);
  const totalPower = parsed.power + power + powerAdjust;
  return {
    formula: formatDiceFormula(parsed.count, sides, totalPower),
    sides,
    power: totalPower,
    powerAdjust,
    maxDelta: max,
  };
}

export function applyDiceBonuses(baseFormula, bonuses = {}) {
  return resolveDiceBonuses(baseFormula, bonuses).formula;
}
