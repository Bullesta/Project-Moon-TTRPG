export const NOUNS = {
  // Resources
  toolSlots: {
    kind: "resource",
    path: "system.attributes.toolSlots.value",
    modKey: "toolSlots",
    label: "PMTTRPG.ToolSlots",
    alwaysActive: true,
    ops: ["gain", "lose"],
    pathShorthand: "toolSlots",
  },
  narrativeSlots: {
    kind: "resource",
    path: "system.attributes.narrativeSlots.value",
    modKey: "narrativeSlots",
    label: "PMTTRPG.NarrativeSlots",
    alwaysActive: true,
    ops: ["gain", "lose"],
    pathShorthand: "narrativeSlots",
  },
  stockSlots: {
    kind: "resource",
    path: "system.attributes.stockSlots.value",
    modKey: "stockSlots",
    label: "PMTTRPG.StockSlots",
    alwaysActive: true,
    ops: ["gain", "lose"],
    pathShorthand: "stockSlots",
  },
  maxLight: {
    kind: "resource",
    path: "system.attributes.light.max",
    modKey: "lightBonus",
    label: "PMTTRPG.Light",
    alwaysActive: true,
    ops: ["gain", "lose"],
  },
  maxHp: {
    kind: "resource",
    path: "system.attributes.hp.maxMisc",
    modKey: "maxHp",
    label: "PMTTRPG.TrackerHP",
    alwaysActive: true,
    ops: ["gain", "lose"],
  },
  maxSt: {
    kind: "resource",
    path: "system.attributes.st.maxMisc",
    modKey: "maxSt",
    label: "PMTTRPG.Stagger",
    alwaysActive: true,
    ops: ["gain", "lose"],
  },
  maxSp: {
    kind: "resource",
    path: "system.attributes.sp.maxMisc",
    modKey: "maxSp",
    label: "PMTTRPG.Mentality",
    alwaysActive: true,
    ops: ["gain", "lose"],
  },
  speed: {
    kind: "resource",
    path: "system.attributes.speed.bonus",
    modKey: "speed",
    label: "PMTTRPG.Speed",
    alwaysActive: true,
    ops: ["gain", "lose"],
    pathShorthand: "speedBonus",
  },

  // Combat
  attack: {
    kind: "combat",
    ops: ["power up", "power down", "dice max up", "dice max down"],
    powerField: "attackPower",
    maxField: "attackMax",
    pathShorthand: ["attributes", "attackModifier"],
  },
  block: {
    kind: "combat",
    ops: ["power up", "power down", "dice max up", "dice max down"],
    powerField: "blockPower",
    maxField: "blockMax",
    pathShorthand: ["attributes", "blockModifier"],
  },
  evade: {
    kind: "combat",
    ops: ["power up", "power down", "dice max up", "dice max down"],
    powerField: "evadePower",
    maxField: "evadeMax",
    pathShorthand: ["attributes", "evadeModifier"],
  },
  damage: {
    kind: "combat",
    ops: ["power up", "power down", "dice max up", "dice max down", "deal"],
    powerField: "damagePower",
    maxField: "damageMax",
  },

  // Pools
  hp: {
    kind: "pool",
    ops: ["regen"],
    regenField: "regenHP",
    pathShorthand: "hp",
  },
  st: {
    kind: "pool",
    ops: ["regen"],
    regenField: "regenST",
    pathShorthand: "st",
  },
  sp: {
    kind: "pool",
    ops: ["regen"],
    regenPath: "system.attributes.sp.value",
    regenMaxPath: "system.attributes.sp.max",
    pathShorthand: "sp",
  },
  light: {
    kind: "pool",
    ops: ["regen"],
    regenPath: "system.attributes.light.value",
    regenMaxPath: "system.attributes.light.max",
    pathShorthand: "light",
  },

  // Paths
  rank: {
    kind: "path",
    pathShorthand: ["attributes", "rank"],
  },
};

const _byId = new Map();
for (const [id, def] of Object.entries(NOUNS)) {
  _byId.set(id, { id, def });
  for (const alias of def.aliases ?? []) {
    _byId.set(alias, { id, def });
  }
}

export function lookupNoun(name) {
  if (!name) return null;
  return _byId.get(name) ?? null;
}

export function isResourceNoun(name) {
  const hit = lookupNoun(name);
  return !!hit && hit.def.kind === "resource";
}

export function nounAllowsOp(name, op) {
  const hit = lookupNoun(name);
  if (!hit) return false;
  return (hit.def.ops ?? []).includes(op);
}

export function isReservedNoun(name) {
  const hit = lookupNoun(name);
  return !!hit && (hit.def.ops ?? []).length > 0;
}

export function isBonusNoun(name) {
  return nounAllowsOp(name, "power up") || nounAllowsOp(name, "dice max up");
}

export function isRegenNoun(name) {
  return nounAllowsOp(name, "regen");
}

export function getPowerField(name) {
  return lookupNoun(name)?.def.powerField ?? null;
}

export function getMaxField(name) {
  return lookupNoun(name)?.def.maxField ?? null;
}

export function getRegenField(name) {
  return lookupNoun(name)?.def.regenField ?? null;
}

export async function recoverPool(actor, name, amount) {
  const def = lookupNoun(name)?.def;
  if (!def?.regenPath || !def.regenMaxPath) return false;

  const read = path => {
    const parts = path.replace(/^system\./, "").split(".");
    let value = actor.system;
    for (const part of parts) value = value?.[part];
    return Number(value) || 0;
  };

  const current = read(def.regenPath);
  const max = read(def.regenMaxPath);
  const next = Math.min(Math.max(current + amount, 0), max);
  if (next !== current) await actor.update({ [def.regenPath]: next });
  return true;
}

export function resolvePathShorthand(actor, segment) {
  const hit = lookupNoun(segment);
  if (!hit?.def.pathShorthand) return null;
  const sh = hit.def.pathShorthand;
  if (sh === "speedBonus") return actor.system.attributes?.speed?.bonus ?? 0;
  if (typeof sh === "string") return actor.system.attributes?.[sh]?.value ?? 0;
  if (Array.isArray(sh) && sh.length === 2) {
    const [sec, key] = sh;
    return actor.system[sec]?.[key]?.value ?? 0;
  }
  return null;
}

export function emptyAlwaysActiveMods() {
  const mods = {
    attackPower: 0, blockPower: 0, evadePower: 0, damagePower: 0,
    attackMax:   0, blockMax:   0, evadeMax:   0, damageMax:   0,
    lightBonus:  0,
  };
  for (const def of Object.values(NOUNS)) {
    if (def.kind !== "resource" || !def.alwaysActive) continue;
    const key = def.modKey ?? null;
    if (key && mods[key] === undefined) mods[key] = 0;
  }
  return mods;
}

export function applyResourceMod(mods, nounId, signedAmount) {
  const hit = lookupNoun(nounId);
  if (!hit || hit.def.kind !== "resource") return false;
  if (!hit.def.alwaysActive) return false;
  const key = hit.def.modKey ?? hit.id;
  mods[key] = (mods[key] ?? 0) + signedAmount;
  return true;
}

export function applyResourceModsToSystem(systemData, eeMods) {
  for (const [id, def] of Object.entries(NOUNS)) {
    if (def.kind !== "resource" || !def.alwaysActive || !def.path) continue;
    const amount = eeMods[def.modKey ?? id] ?? 0;
    if (!amount) continue;
    const rel = def.path.replace(/^system\./, "");
    const parts = rel.split(".");
    let cur = systemData;
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur?.[parts[i]];
      if (cur == null) break;
    }
    const leaf = parts[parts.length - 1];
    if (cur && leaf in cur) cur[leaf] = (Number(cur[leaf]) || 0) + amount;
  }
}
