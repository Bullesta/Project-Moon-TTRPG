/** Inventory slot use for tools and specialized ammunition (soon explosives)*/

const SPECIALIZED_AMMO_PER_SLOT = 5;
const INVENTORY_POOLS = ["tool", "narrative", "stock"];

const PACKING_CATEGORIES = {
  ammunition: {
    matches: item =>
      item?.type === "ammunition"
      && (item.system?.ammoType ?? "standard") === "specialized",
    quantity: item => Math.max(0, Number(item.system?.quantity) || 0),
    slotCost: remaining => packedSlots(remaining, SPECIALIZED_AMMO_PER_SLOT),
  },
};

function packedSlots(quantity, perSlot = 1) {
  const qty = Math.max(0, Number(quantity) || 0);
  const stack = Math.max(1, Number(perSlot) || 1);
  if (qty <= 0) return 0;
  return Math.ceil(qty / stack);
}

export function toolQuantity(item) {
  return Math.max(0, Number(item?.system?.quantity) || 0);
}

export function isToolPresent(item) {
  return item?.type === "tool" && toolQuantity(item) > 0;
}

export function isToolPackingActive(item) {
  if (!isToolPresent(item)) return false;
  return !!item.system?.equipped;
}

function packingPool(item) {
  if (item?.type === "ammunition") {
    return item.system?.inventoryPool === "stock" ? "stock" : "tool";
  }
  if (item?.type === "tool") {
    if (!isToolPresent(item)) return null;
    const tag = item.system?.inventoryTag ?? "tool";
    if (tag === "narrative" || tag === "stock") return tag;
    return "tool";
  }
  return itemInventoryPool(item);
}

export function normalizePackingAccepts(accepts) {
  if (accepts === "specializedAmmunition") return "ammunition";
  return accepts || "none";
}

export function specializedAmmoSlotCost(item) {
  if (item?.type !== "ammunition") return 0;
  if ((item.system?.ammoType ?? "standard") !== "specialized") return 0;
  return packedSlots(item.system?.quantity ?? 0, SPECIALIZED_AMMO_PER_SLOT);
}


export function slotCostFromHand(handProperty) {
  if (handProperty === "twoHanded") return 2;
  return 1;
}

export function toolSlotCost(item) {
  if (!isToolPresent(item)) return 0;
  const data = item.system ?? {};
  if (data.compact) return 0;
  const slotCost = Math.max(0, Number(data.slotCost) || 0);
  if (slotCost <= 0) return 0;
  const qty = toolQuantity(item);
  const stackPerSlot = Math.max(1, Number(data.stackPerSlot) || 1);
  if (stackPerSlot <= 1) return slotCost;
  return packedSlots(qty, stackPerSlot) * slotCost;
}

export function itemInventoryPool(item) {
  if (item?.type === "ammunition") {
    if ((item.system?.ammoType ?? "standard") !== "specialized") return null;
    return item.system?.inventoryPool === "stock" ? "stock" : "tool";
  }
  if (item?.type === "tool") {
    if (!isToolPresent(item)) return null;
    if (item.system?.compact) return null;
    const tag = item.system?.inventoryTag ?? "tool";
    if (tag === "narrative" || tag === "stock") return tag;
    return "tool";
  }
  return null;
}

export function computeInventoryState(items) {
  const itemList = Array.from(items ?? []);
  const used = { tool: 0, narrative: 0, stock: 0 };
  const packing = {};
  const providers = new Map();
  const cargo = new Map();

  for (const item of itemList) {
    if (item.type === "tool") {
      const pool = itemInventoryPool(item);
      if (pool) {
        const cost = toolSlotCost(item);
        if (cost > 0) used[pool] += cost;
      }

      if (!isToolPackingActive(item)) {
        const id = item.id ?? item._id;
        if (id && item.system?.packing) {
          packing[id] = {
            used: 0,
            capacity: Math.max(0, Number(item.system.packing.capacity) || 0),
            free: 0,
          };
        }
        continue;
      }

      const accepts = normalizePackingAccepts(item.system?.packing?.accepts);
      const capacity = Math.max(0, Number(item.system?.packing?.capacity) || 0);
      const id = item.id ?? item._id;
      const providerPool = packingPool(item);
      if (PACKING_CATEGORIES[accepts] && capacity > 0 && id && providerPool) {
        const key = `${providerPool}:${accepts}`;
        if (!providers.has(key)) providers.set(key, []);
        providers.get(key).push({ id, capacity, sort: Number(item.sort) || 0 });
        packing[id] = { used: 0, capacity, free: capacity };
      }
    }

    for (const [category, definition] of Object.entries(PACKING_CATEGORIES)) {
      if (!definition.matches(item)) continue;
      const pool = packingPool(item);
      if (!pool) break;
      const key = `${pool}:${category}`;
      cargo.set(key, (cargo.get(key) ?? 0) + definition.quantity(item));
      break;
    }
  }

  for (const pool of INVENTORY_POOLS) {
    for (const [category, definition] of Object.entries(PACKING_CATEGORIES)) {
      const key = `${pool}:${category}`;
      let remaining = cargo.get(key) ?? 0;
      const poolProviders = (providers.get(key) ?? [])
        .sort((a, b) => a.sort - b.sort);

      for (const provider of poolProviders) {
        const packed = Math.min(provider.capacity, remaining);
        packing[provider.id].used = packed;
        packing[provider.id].free = provider.capacity - packed;
        remaining -= packed;
      }

      used[pool] += definition.slotCost(remaining);
    }
  }

  return { used, packing };
}

export function computeInventorySlotUsage(items) {
  return computeInventoryState(items).used;
}

export function applyInventorySlotUsage(attributes, items) {
  const itemList = Array.from(items ?? []);
  const { used, packing } = computeInventoryState(itemList);

  attributes.toolSlots = attributes.toolSlots || {};
  attributes.narrativeSlots = attributes.narrativeSlots || {};
  attributes.stockSlots = attributes.stockSlots || {};

  if (attributes.toolSlots.value == null) attributes.toolSlots.value = 4;
  if (attributes.narrativeSlots.value == null) attributes.narrativeSlots.value = 4;
  if (attributes.stockSlots.value == null) attributes.stockSlots.value = 4;

  attributes.toolSlots.used = used.tool;
  attributes.narrativeSlots.used = used.narrative;
  attributes.stockSlots.used = used.stock;

  for (const item of itemList) {
    if (item.type !== "tool" || !item.system?.packing) continue;
    const id = item.id ?? item._id;
    const present = isToolPresent(item);
    const packingActive = isToolPackingActive(item);
    const capacity = Math.max(0, Number(item.system.packing.capacity) || 0);
    const state = packing[id] ?? { used: 0, capacity, free: packingActive ? capacity : 0 };
    item.system.packing.accepts = normalizePackingAccepts(item.system.packing.accepts);
    item.system.packing.used = packingActive ? state.used : 0;
    item.system.packing.free = packingActive ? state.free : 0;
  }

  return used;
}
