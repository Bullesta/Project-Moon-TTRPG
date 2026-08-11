import { isPendingStatus, normalizeArrival } from "./pending.js";

export function groupStatuses(actor, { sort = "display" } = {}) {
  if (!actor?.items) return [];

  const activeGrouped = new Map();
  const pendingEntries = [];

  for (const item of actor.items) {
    if (item.type !== "status") continue;
    const name = item.name?.trim();
    if (!name) continue;

    const entryStacks = Math.max(0, Number(item.system?.stacks ?? 1) || 0);
    if (entryStacks <= 0) continue;

    const entryMax = Math.max(0, Number(item.system?.stackMax ?? 0) || 0);
    const entryPriority = Math.max(0, Math.min(100, Number(item.system?.priority ?? 0) || 0));

    if (isPendingStatus(item)) {
      pendingEntries.push({
        key: `${name.toLowerCase()}::pending::${item.id}`,
        name,
        img: item.img,
        count: entryStacks,
        stackMax: entryMax,
        priority: entryPriority,
        itemId: item.id,
        description: item.system?.description ?? "",
        representative: item,
        items: [item],
        pending: true,
        arrival: normalizeArrival(item.system?.arrival),
        fillRatio: entryMax > 0 ? entryStacks / entryMax : 1,
        showCount: entryMax !== 1,
      });
      continue;
    }

    const key = name.toLowerCase();
    const existing = activeGrouped.get(key);
    if (!existing) {
      activeGrouped.set(key, {
        key,
        name,
        img: item.img,
        count: entryStacks,
        stackMax: entryMax,
        priority: entryPriority,
        itemId: item.id,
        description: item.system?.description ?? "",
        representative: item,
        items: [item],
        copies: 1,
        hasStacksField: item.system?.stacks != null,
        pending: false,
        arrival: null,
      });
      continue;
    }

    existing.items.push(item);
    existing.copies += 1;
    if (item.system?.stacks != null || existing.hasStacksField) {
      existing.hasStacksField = true;
      existing.count += entryStacks;
    } else {
      existing.count += 1;
    }
    if (entryMax > 0 && (!existing.stackMax || entryMax < existing.stackMax)) {
      existing.stackMax = entryMax;
    }
    existing.priority = Math.max(existing.priority, entryPriority);
    existing.img ||= item.img;
    existing.description ||= item.system?.description ?? "";
  }

  const active = [...activeGrouped.values()].map(({ copies, hasStacksField, ...status }) => {
    let fillRatio = 0;
    if (status.stackMax > 0) fillRatio = status.count / status.stackMax;
    else if (status.count > 0) fillRatio = 1;

    return {
      ...status,
      fillRatio,
      showCount: status.stackMax !== 1,
    };
  });

  const sortActive = (statuses) => {
    if (sort === "name") {
      statuses.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "display" || sort === "applied") {
      statuses.sort((a, b) =>
        (b.priority - a.priority)
        || (b.fillRatio - a.fillRatio)
        || (b.count - a.count)
        || a.name.localeCompare(b.name)
      );
    }
    return statuses;
  };

  sortActive(active);
  pendingEntries.sort((a, b) => a.name.localeCompare(b.name));

  return [...active, ...pendingEntries];
}

export function uniqueStatusItems(items = []) {
  const byName = new Map();
  for (const item of items) {
    if (item.type !== "status") continue;
    if (isPendingStatus(item)) continue;
    const key = item.name?.trim().toLowerCase();
    if (key && !byName.has(key)) byName.set(key, item);
  }
  return [...byName.values()];
}

const statusItemListeners = new Set();
let statusHooksRegistered = false;

export function onStatusItemChange(listener) {
  statusItemListeners.add(listener);
  if (statusHooksRegistered) return;
  statusHooksRegistered = true;

  const notify = (item) => {
    if (item?.type !== "status") return;
    for (const callback of statusItemListeners) callback(item);
  };
  Hooks.on("createItem", notify);
  Hooks.on("deleteItem", notify);
  Hooks.on("updateItem", notify);
}
