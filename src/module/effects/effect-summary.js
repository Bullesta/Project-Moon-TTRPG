import { PMTTRPGUtility } from "../utility.js";

const CLASH_PROC_TYPES = new Set(["onClash", "onClashResult", "onEitherClashResult"]);

function toCssToken(value = "") {
  return `${value}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getGroupSort(effect = {}) {
  const procOn = effect?.procOn ?? "alwaysActive";
  const procResult = effect?.procResult ?? "none";

  if (procOn === "alwaysActive") return 0;
  if (procOn === "onCondition") return 10;
  if (procOn === "onClash") {
    if (procResult === "win") return 21;
    if (procResult === "lose") return 22;
    return 20;
  }
  if (procOn === "onClashResult") {
    if (procResult === "win") return 31;
    if (procResult === "lose") return 32;
    return 30;
  }
  if (procOn === "onEitherClashResult") {
    if (procResult === "win") return 41;
    if (procResult === "lose") return 42;
    return 40;
  }
  if (procOn === "onUse") return 50;
  if (procOn === "onBurst") return 60;
  if (procOn === "onCritical") return 70;
  if (procOn === "onDevastating") return 80;
  if (procOn === "onAction") return 90;

  return 999;
}

export function getEffectStack(effect = {}) {
  const stackRaw = Number(effect?.stack ?? effect?.count ?? 1);
  const stackMaxRaw = Number(effect?.stackMax ?? 5);
  const stackMax = Math.max(1, Number.isFinite(stackMaxRaw) ? stackMaxRaw : 5);
  return Math.max(1, Math.min(stackMax, Number.isFinite(stackRaw) ? stackRaw : 1));
}

export function buildEffectSummaryGroups(effects = []) {
  const topGroups = new Map();

  const addLine = (groupKey, groupLabel, groupSort, subKey, subLabel, lineText) => {
    if (!topGroups.has(groupKey)) {
      topGroups.set(groupKey, {
        key: groupKey,
        heading: groupLabel,
        sort: groupSort,
        lines: [],
        subgroups: new Map(),
        subgroupOrder: []
      });
    }

    const group = topGroups.get(groupKey);
    group.sort = Math.min(group.sort ?? groupSort, groupSort);

    if (subKey) {
      if (!group.subgroups.has(subKey)) {
        group.subgroups.set(subKey, {
          key: subKey,
          heading: subLabel,
          lines: []
        });
        group.subgroupOrder.push(subKey);
      }

      group.subgroups.get(subKey).lines.push(lineText);
      return;
    }

    group.lines.push(lineText);
  };

  for (const effect of effects ?? []) {
    const stack = getEffectStack(effect);
    const textSource = effect.mode === "negative"
      ? (effect.negative || effect.positive || "")
      : (effect.positive || effect.negative || "");
    const text = PMTTRPGUtility.expandEffectText(textSource, stack).trim();
    const lineText = foundry.utils.escapeHTML(text || game.i18n.localize("PMTTRPG.EffectNoSummaryText"));
    const procOn = effect?.procOn ?? "alwaysActive";
    const procCondition = `${effect?.procCondition ?? ""}`.trim();

    if (procOn === "alwaysActive") {
      const groupLabel = game.i18n.localize("PMTTRPG.EffectProcAlwaysActive");
      const groupSort = getGroupSort({ procOn: "alwaysActive" });

      if (procCondition) {
        addLine("alwaysActive", groupLabel, groupSort, `condition:${procCondition.toLowerCase()}`, procCondition, lineText);
      }
      else {
        addLine("alwaysActive", groupLabel, groupSort, "", "", lineText);
      }
      continue;
    }

    const procResult = effect?.procResult ?? "none";
    const groupKey = CLASH_PROC_TYPES.has(procOn) ? `${procOn}:${procResult}` : procOn;
    const groupLabel = PMTTRPGUtility.formatEffectProcLabel(effect);
    const groupSort = getGroupSort(effect);
    addLine(groupKey, groupLabel, groupSort, "", "", lineText);
  }

  const renderLines = (lines = []) => lines.map(line => `<span class="effect-summary-line">- ${line}</span>`).join("<br>");
  const renderGroup = (group) => {
    const groupClass = toCssToken(group.key || group.heading || "group");
    const parts = [`<span class="effect-summary-tag effect-summary-tag--${groupClass}">[${foundry.utils.escapeHTML(group.heading)}]</span>`];

    if (group.lines.length) {
      parts.push(renderLines(group.lines));
    }

    for (const subKey of group.subgroupOrder) {
      const subgroup = group.subgroups.get(subKey);
      const subgroupClass = toCssToken(subgroup.key || subgroup.heading || "subgroup");
      parts.push(`
        <div class="effect-summary-subgroup">
          <span class="effect-summary-tag effect-summary-tag--sub effect-summary-tag--${subgroupClass}">
            [${foundry.utils.escapeHTML(subgroup.heading)}]
          </span>
          <br>
          ${renderLines(subgroup.lines)}
        </div>`);
    }

    return `<div class="effect-summary-block">${parts.join("<br>")}</div>`;
  };

  const orderedKeys = Array.from(topGroups.values())
    .sort((left, right) => {
      if ((left.sort ?? 999) !== (right.sort ?? 999)) {
        return (left.sort ?? 999) - (right.sort ?? 999);
      }

      return (left.heading ?? "").localeCompare(right.heading ?? "");
    })
    .map(group => group.key);

  return [{
    key: "combined",
    heading: game.i18n.localize("PMTTRPG.Effects"),
    summaryText: orderedKeys.map(key => renderGroup(topGroups.get(key))).join("<br><br>")
  }];
}
