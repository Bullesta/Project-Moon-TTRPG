/**
 * Two dialogs:
 *
 *   showRetaliationDialog(actor, state, { isIntercept })
 *     Shown when a player clicks Retaliate or Intercept.
 *     Lets them pick: Evade / Recycled Evade / Block / Counter (+ weapon)
 *     Optional matching Skill or Applied Tool (mutex) on Block / Evade /
 *     Counter / Recycled Evade.
 *     Returns a RetaliationChoice or null if cancelled.
 *
 *   showInterceptConfirmDialog(actorName)
 *     Two-click confirmation shown when Intercept is used as the selected token.
 *     Returns true (confirmed) or false.
 *
 * @typedef {object} RetaliationChoice
 * @property {"evade"|"recycledEvade"|"block"|"counter"|"intercept"|"onesided"} type
 * @property {Item|null} item   — chosen weapon for counter; outfit for evade/block
 * @property {Item|null} [skillItem]
 * @property {boolean} [consumeSkillLight]
 * @property {Item|null} [appliedTool]
 * @property {boolean} [consumeAppliedTool]
 * @property {boolean} [recycled]
 * @property {Item|null} [ammo]
 * @property {boolean} [consumeAmmo]
 * @property {boolean} [dryFire]
 */

import { PMTTRPGUtility } from "../utility.js";
import {
  getAppliedToolOptions,
  isAppliedToolEligible,
} from "../item/applied-tool.js";
import { getToolUsesRemaining, toolConsumesByDefault } from "../item/tool-use.js";
import { RETALIATION_TYPES } from "./clash-state.js";
import { getRecycledEvade } from "./recycled-evade.js";

const { renderTemplate } = foundry.applications.handlebars;

const TEMPLATE_RETALIATION = "systems/projectmoonttrpg/templates/dialog/clash/retaliation-dialog.hbs";
const TEMPLATE_AMMO = "systems/projectmoonttrpg/templates/dialog/weapon-ammo-dialog.html";

// ── Intercept confirmation ────────────────────────────────────────────────────

/**
 * Shows a two-click "Are you sure you want to intercept?" confirmation.
 * @param {string} [actorName]
 * @returns {Promise<boolean>}
 */
export async function showInterceptConfirmDialog(actorName = "") {
  const result = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("PMTTRPG.Clash.InterceptTitle") },
    content: `<p>${game.i18n.format("PMTTRPG.Clash.InterceptConfirm", { name: actorName })}</p>`,
    classes: _dialogClasses(),
    rejectClose: false,
    yes: { label: game.i18n.localize("PMTTRPG.Clash.InterceptConfirmYes"), icon: "fa-solid fa-person-running" },
    no:  { label: game.i18n.localize("PMTTRPG.Dialog.cancel"),             icon: "fa-solid fa-xmark" },
  });
  return result === true;
}

// ── Retaliation dialog ────────────────────────────────────────────────────────

/**
 * Shows the retaliation option dialog.
 *
 * @param {ActorPMTTRPG} actor        — the actor who is retaliating
 * @param {ClashStateData} state
 * @param {object} [options]
 * @param {boolean} [options.isIntercept=false]
 * @returns {Promise<RetaliationChoice|null>}
 */
export async function showRetaliationDialog(actor, state, { isIntercept = false } = {}) {
  const equippedWeapons = actor.items
    .filter(i => i.type === "weapon" && i.system?.equipped)
    .map(i => ({ id: i.id, name: i.name, img: i.img, type: "weapon" }));

  const equippedOutfits = actor.items
    .filter(i => i.type === "outfit" && i.system?.equipped)
    .map(i => ({ id: i.id, name: i.name, img: i.img, type: "outfit" }));

  const skills = actor.items
    .filter(i => i.type === "skill")
    .map(i => ({ id: i.id, name: i.name, img: i.img, skillType: String(i.system?.skillType ?? "attack").toLowerCase() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const appliedTools = _appliedToolEntries(actor);

  const recycled = getRecycledEvade(actor);

  const templateData = {
    actor,
    state,
    isIntercept,
    equippedWeapons,
    equippedOutfits,
    skills,
    appliedTools,
    recycledEvade: recycled,
    options: _buildRetaliationOptions(equippedWeapons, equippedOutfits, recycled),
    i18n: {
      title:      isIntercept
        ? game.i18n.localize("PMTTRPG.Clash.InterceptTitle")
        : game.i18n.localize("PMTTRPG.Clash.RetaliateTitle"),
      evade:      game.i18n.localize("PMTTRPG.Clash.Evade"),
      block:      game.i18n.localize("PMTTRPG.Clash.Block"),
      counter:    game.i18n.localize("PMTTRPG.Clash.Counter"),
      onesided:   game.i18n.localize("PMTTRPG.Clash.OneSided"),
      attackedBy: game.i18n.format("PMTTRPG.Clash.AttackedBy", { name: state.attackerName }),
      outfit:     game.i18n.localize("PMTTRPG.Clash.ChooseOutfit"),
      weapon:     game.i18n.localize("PMTTRPG.Clash.ChooseWeapon"),
      skill:      game.i18n.localize("PMTTRPG.Clash.ChooseSkill"),
      skillOptional: game.i18n.localize("PMTTRPG.Clash.OptionalSkill"),
      skillNone:  game.i18n.localize("PMTTRPG.Clash.NoSkill"),
      consumeLight: game.i18n.localize("PMTTRPG.Dialog.consumeLight"),
      toolOptional: game.i18n.localize("PMTTRPG.Clash.OptionalAppliedTool"),
      toolNone:   game.i18n.localize("PMTTRPG.Dialog.noAppliedTool"),
      consumeTool: game.i18n.localize("PMTTRPG.Dialog.consumeToolUse"),
      confirm:    game.i18n.localize("PMTTRPG.Clash.Confirm"),
      cancel:     game.i18n.localize("PMTTRPG.Dialog.cancel"),
    },
  };

  const html = await renderTemplate(TEMPLATE_RETALIATION, templateData);

  return foundry.applications.api.DialogV2.wait({
    window: { title: templateData.i18n.title },
    classes: _dialogClasses(),
    content: html,
    buttons: [
      {
        action: "confirm",
        label: templateData.i18n.confirm,
        icon: "fa-solid fa-check",
        default: true,
        callback: (event, button, dialog) => _readRetaliationForm(dialog, actor),
      },
      {
        action: "cancel",
        label: templateData.i18n.cancel,
        icon: "fa-solid fa-xmark",
        callback: () => null,
      },
    ],
    rejectClose: false,
    render: (event, dialog) => _bindRetaliationDialogListeners(dialog),
  });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Builds the ordered list of retaliation options for the template.
 */
function _buildRetaliationOptions(weapons, outfits, recycled) {
  const options = [];

  if (recycled && outfits.length) {
    options.push({
      type: RETALIATION_TYPES.RECYCLED_EVADE,
      labelText: game.i18n.format("PMTTRPG.Clash.RecycledEvade", { penalty: recycled.penalty }),
      icon: "systems/projectmoonttrpg/assets/icons/sheet/01_evade",
      requiresItem: true,
      items: outfits,
      recycled: true,
    });
  }

  if (outfits.length) {
    options.push({
      type: RETALIATION_TYPES.EVADE,
      label: "PMTTRPG.Clash.Evade",
      icon: "systems/projectmoonttrpg/assets/icons/sheet/01_evade",
      requiresItem: true,
      items: outfits,
    });
    options.push({
      type: RETALIATION_TYPES.BLOCK,
      label: "PMTTRPG.Clash.Block",
      icon: "systems/projectmoonttrpg/assets/icons/sheet/01_defense",
      requiresItem: true,
      items: outfits,
    });
  }

  if (weapons.length) {
    options.push({
      type: RETALIATION_TYPES.COUNTER,
      label: "PMTTRPG.Clash.Counter",
      icon: "systems/projectmoonttrpg/assets/icons/sheet/00_slash",
      requiresItem: true,
      items: weapons,
    });
  }

  options.push({
    type: "onesided",
    label: "PMTTRPG.Clash.OneSided",
    icon: "systems/projectmoonttrpg/assets/icons/sheet/03_danger1",
    requiresItem: false,
  });

  return options;
}

function _skillTypeForRetaliation(type) {
  if (type === RETALIATION_TYPES.BLOCK) return "block";
  if (type === RETALIATION_TYPES.EVADE || type === RETALIATION_TYPES.RECYCLED_EVADE) return "evade";
  if (type === RETALIATION_TYPES.COUNTER) return "attack";
  return null;
}

/**
 * Weapon Applied Tools declare on Attack/Counter.
 * Outfit Applied Tools declare on Block/Evade.
 */
function _applyToForRetaliation(type) {
  if (type === RETALIATION_TYPES.COUNTER) return "weapon";
  if (
    type === RETALIATION_TYPES.BLOCK
    || type === RETALIATION_TYPES.EVADE
    || type === RETALIATION_TYPES.RECYCLED_EVADE
  ) return "outfit";
  return null;
}

function _appliedToolEntries(actor) {
  const map = (applyTo) => getAppliedToolOptions(actor, applyTo).map(item => ({
    id: item.id,
    name: item.name,
    remaining: getToolUsesRemaining(item),
    applyTo,
    consumes: toolConsumesByDefault(item),
  }));
  return [...map("weapon"), ...map("outfit")];
}

/**
 * Reads and validates the submitted retaliation form.
 * Returns a RetaliationChoice or null.
 */
function _readRetaliationForm(dialog, actor) {
  const form = dialog.element?.querySelector("form");
  if (!form) return null;

  const type   = form.querySelector("[name='retaliationType']:checked")?.value ?? null;
  const itemId = form.querySelector("[name='retaliationItemId']")?.value?.trim() ?? null;
  const skillId = form.querySelector("[name='declaredSkillId']")?.value?.trim() ?? "";
  const consumeSkillLight = form.querySelector("[name='consumeSkillLight']")?.checked !== false;
  const toolId = form.querySelector("[name='appliedToolId']")?.value?.trim() ?? "";
  const consumeAppliedTool = form.querySelector("[name='consumeAppliedTool']")?.checked !== false;

  if (!type) return null;

  let item = null;
  if (itemId) {
    item = actor.items.get(itemId) ?? null;
  }
  // For counter, require an item selection.
  if (type === RETALIATION_TYPES.COUNTER && !item) {
    ui.notifications.warn(game.i18n.localize("PMTTRPG.Clash.NoItemSelected"));
    return null;
  }

  const wantType = _skillTypeForRetaliation(type);
  let skillItem = null;
  if (wantType && skillId) {
    const picked = actor.items.get(skillId) ?? null;
    if (picked?.type === "skill" && String(picked.system?.skillType ?? "attack").toLowerCase() === wantType) {
      skillItem = picked;
    }
  }

  const applyTo = _applyToForRetaliation(type);
  let appliedTool = null;
  if (!skillItem && applyTo && toolId) {
    const picked = actor.items.get(toolId) ?? null;
    if (isAppliedToolEligible(picked, applyTo)) appliedTool = picked;
  }

  return {
    type,
    item,
    skillItem,
    consumeSkillLight: !!skillItem && consumeSkillLight,
    appliedTool,
    consumeAppliedTool: !!appliedTool && consumeAppliedTool,
    recycled: type === RETALIATION_TYPES.RECYCLED_EVADE,
  };
}

/**
 * Prompt ammo and dry-fire for ranged attacks.
 *
 * @param {ActorPMTTRPG} actor
 * @param {Item} weapon
 * @param {{ shootLabel?: string }} [options]
 * @returns {Promise<{ ammo: Item|null, consumeAmmo: boolean, dryFire: boolean }|null>}
 */
export async function promptRangedAmmo(actor, weapon, { shootLabel } = {}) {
  const ammoOptions = (actor.items ?? [])
    .filter(i => i.type === "ammunition" && Number(i.system?.quantity ?? 0) > 0)
    .map((item, index) => ({
      id: item.id,
      name: item.name,
      img: item.img,
      quantity: Number(item.system?.quantity ?? 0),
      ammoType: item.system?.ammoType ?? null,
      damageType: item.system?.damageType ?? null,
      isDefault: index === 0,
      ammoTypeLabel: item.system?.ammoType
        ? game.i18n.localize(`PMTTRPG.Ammo${item.system.ammoType[0].toUpperCase()}${item.system.ammoType.slice(1)}`)
        : null,
      damageTypeLabel: item.system?.damageType
        ? game.i18n.localize(`PMTTRPG.DamageType${item.system.damageType[0].toUpperCase()}${item.system.damageType.slice(1)}`)
        : null,
    }));

  const html = await renderTemplate(TEMPLATE_AMMO, {
    weapon: {
      name: weapon.name,
      img: weapon.img,
      offensiveDiceComputed: weapon.system?.offensiveDiceComputed,
      system: { damageType: weapon.system?.damageType },
    },
    ammoOptions,
  });

  const buttons = [];
  if (ammoOptions.length) {
    buttons.push({
      action: "shoot",
      label: shootLabel || game.i18n.localize("PMTTRPG.Dialog.roll"),
      icon: "fa-solid fa-bullseye",
      default: true,
      callback: (event, button, dialog) => {
        const form = dialog.element?.querySelector("form");
        const ammoId = form?.ammoId?.value;
        const ammo = ammoId ? actor.items.get(ammoId) ?? null : null;
        if (!ammo) {
          ui.notifications.warn(game.i18n.localize("PMTTRPG.Clash.NoAmmoSelected"));
          return null;
        }
        return {
          ammo,
          consumeAmmo: form?.consumeAmmo?.checked !== false,
          dryFire: false,
        };
      },
    });
  }
  buttons.push({
    action: "dryfire",
    label: game.i18n.localize("PMTTRPG.Clash.DryFire"),
    icon: "fa-solid fa-triangle-exclamation",
    default: !ammoOptions.length,
    callback: () => ({ ammo: null, consumeAmmo: false, dryFire: true }),
  });
  buttons.push({
    action: "cancel",
    label: game.i18n.localize("PMTTRPG.Dialog.cancel"),
    icon: "fa-solid fa-xmark",
    callback: () => null,
  });

  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("PMTTRPG.Dialog.chooseAmmunition") },
    classes: _dialogClasses(),
    content: html,
    buttons,
    rejectClose: false,
  });
}

/** @deprecated Prefer {@link promptRangedAmmo} */
export async function promptRangedCounterAmmo(actor, weapon) {
  return promptRangedAmmo(actor, weapon, {
    shootLabel: game.i18n.localize("PMTTRPG.Clash.Counter"),
  });
}

/**
 * Wires show/hide of the item picker sub-list based on which option is selected.
 */
function _bindRetaliationDialogListeners(dialog) {
  const el = dialog.element;
  if (!el) return;

  const radios    = el.querySelectorAll("[name='retaliationType']");
  const itemPicker = el.querySelector(".clash-item-picker");
  const itemKind = el.querySelector(".clash-item-picker__kind");
  const skillPicker = el.querySelector(".clash-skill-picker");
  const skillSelect = el.querySelector("[name='declaredSkillId']");
  const consumeWrap = el.querySelector(".clash-skill-consume");
  const toolPicker = el.querySelector(".clash-tool-picker");
  const toolSelect = el.querySelector("[name='appliedToolId']");
  const toolConsumeWrap = el.querySelector(".clash-tool-consume");

  const fillNoneOption = (select, label) => {
    if (!select) return;
    select.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = label;
    select.appendChild(none);
  };

  const refreshToolConsume = () => {
    const consumes = toolSelect?.selectedOptions?.[0]?.dataset?.consumes === "1";
    if (toolConsumeWrap) toolConsumeWrap.style.display = consumes ? "" : "none";
  };

  const refreshConsume = () => {
    const hasSkill = !!skillSelect?.value;
    if (consumeWrap) consumeWrap.style.display = hasSkill ? "" : "none";
  };

  const refreshTools = () => {
    const selected = el.querySelector("[name='retaliationType']:checked")?.value;
    const applyTo = _applyToForRetaliation(selected);
    const hasSkill = !!skillSelect?.value;
    const noneLabel = toolPicker?.dataset?.noneLabel
      ?? game.i18n.localize("PMTTRPG.Dialog.noAppliedTool");

    fillNoneOption(toolSelect, noneLabel);
    if (applyTo && !hasSkill && toolSelect) {
      const toolOpts = el.querySelectorAll(`.clash-tool-option[data-apply-to="${applyTo}"]`);
      for (const item of toolOpts) {
        const opt = document.createElement("option");
        opt.value = item.dataset.itemId;
        const remaining = item.dataset.remaining;
        opt.textContent = remaining != null && remaining !== ""
          ? `${item.dataset.itemName} (${remaining})`
          : item.dataset.itemName;
        opt.dataset.consumes = item.dataset.consumes ?? "0";
        toolSelect.appendChild(opt);
      }
    }

    const hasTools = applyTo && !hasSkill
      && el.querySelector(`.clash-tool-option[data-apply-to="${applyTo}"]`);
    if (toolPicker) toolPicker.style.display = hasTools ? "" : "none";
    refreshToolConsume();
  };

  const refreshPicker = () => {
    const selected = el.querySelector("[name='retaliationType']:checked")?.value;
    const needsItem = [
      RETALIATION_TYPES.BLOCK,
      RETALIATION_TYPES.EVADE,
      RETALIATION_TYPES.RECYCLED_EVADE,
      RETALIATION_TYPES.COUNTER,
    ].includes(selected);
    if (itemPicker) itemPicker.style.display = needsItem ? "" : "none";

    const applyTo = _applyToForRetaliation(selected);
    if (itemKind) {
      itemKind.textContent = applyTo === "outfit"
        ? (itemKind.dataset.outfit || itemKind.textContent)
        : (itemKind.dataset.weapon || itemKind.textContent);
    }

    const itemSelect = el.querySelector("[name='retaliationItemId']");
    if (itemSelect && needsItem) {
      const items = el.querySelectorAll(`.clash-item-option[data-type="${selected}"]`);
      itemSelect.innerHTML = "";
      for (const item of items) {
        const opt = document.createElement("option");
        opt.value   = item.dataset.itemId;
        opt.textContent = item.dataset.itemName;
        itemSelect.appendChild(opt);
      }
    }

    const wantType = _skillTypeForRetaliation(selected);
    const skillNoneLabel = skillPicker?.dataset?.noneLabel
      ?? game.i18n.localize("PMTTRPG.Clash.NoSkill");
    fillNoneOption(skillSelect, skillNoneLabel);
    if (wantType && skillSelect) {
      const skillOpts = el.querySelectorAll(`.clash-skill-option[data-skill-type="${wantType}"]`);
      for (const item of skillOpts) {
        const opt = document.createElement("option");
        opt.value = item.dataset.itemId;
        opt.textContent = item.dataset.itemName;
        skillSelect.appendChild(opt);
      }
    }

    const hasSkills = wantType && el.querySelector(`.clash-skill-option[data-skill-type="${wantType}"]`);
    if (skillPicker) skillPicker.style.display = hasSkills ? "" : "none";
    refreshConsume();
    refreshTools();
  };

  for (const radio of radios) {
    radio.addEventListener("change", refreshPicker);
  }
  skillSelect?.addEventListener("change", () => {
    refreshConsume();
    refreshTools();
  });
  toolSelect?.addEventListener("change", refreshToolConsume);

  refreshPicker();
}

function _dialogClasses() {
  const classes = ["projectmoonttrpg", "PMTTRPG-dialog"];
  if (PMTTRPGUtility.nightmode) classes.push("nightmode");
  return classes;
}
