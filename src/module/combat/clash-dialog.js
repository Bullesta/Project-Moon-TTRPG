/**
 * Two dialogs:
 *
 *   showRetaliationDialog(actor, state, { isIntercept })
 *     Shown when a player clicks Retaliate or Intercept.
 *     Lets them pick: Evade / Block / Counter (+ weapon) / Use Skill (+ skill item)
 *     Returns a RetaliationChoice or null if cancelled.
 *
 *   showInterceptConfirmDialog()
 *     Two-click confirmation shown when a non-target clicks Intercept.
 *     Returns true (confirmed) or false.
 *
 * @typedef {object} RetaliationChoice
 * @property {"evade"|"block"|"counter"|"intercept"|"skill"|"onesided"} type
 * @property {Item|null} item   — chosen weapon/skill for counter/skill options
 * @property {Item|null} [ammo]
 * @property {boolean} [consumeAmmo]
 * @property {boolean} [dryFire]
 */

import { PMTTRPGUtility } from "../utility.js";
import { RETALIATION_TYPES } from "./clash-state.js";

const { renderTemplate } = foundry.applications.handlebars;

const TEMPLATE_RETALIATION = "systems/projectmoonttrpg/templates/dialog/clash/retaliation-dialog.hbs";
const TEMPLATE_AMMO = "systems/projectmoonttrpg/templates/dialog/weapon-ammo-dialog.html";

// ── Intercept confirmation ────────────────────────────────────────────────────

/**
 * Shows a two-click "Are you sure you want to intercept?" confirmation.
 * @returns {Promise<boolean>}
 */
export async function showInterceptConfirmDialog() {
  const result = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("PMTTRPG.Clash.InterceptTitle") },
    content: `<p>${game.i18n.localize("PMTTRPG.Clash.InterceptConfirm")}</p>`,
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
  // Gather equipped weapons and skills for counter/skill options.
  const equippedWeapons = actor.items
    .filter(i => i.type === "weapon" && i.system?.equipped)
    .map(i => ({ id: i.id, name: i.name, img: i.img, type: "weapon" }));

  const equippedOutfits = actor.items
    .filter(i => i.type === "outfit" && i.system?.equipped)
    .map(i => ({ id: i.id, name: i.name, img: i.img, type: "outfit" }));

  const equippedSkills = actor.items
    .filter(i => i.type === "skill" && i.system?.equipped)
    .map(i => ({ id: i.id, name: i.name, img: i.img, skillType: i.system?.skillType ?? "attack" }));

  const templateData = {
    actor,
    state,
    isIntercept,
    equippedWeapons,
    equippedOutfits,
    equippedSkills,
    options: _buildRetaliationOptions(equippedWeapons, equippedOutfits, equippedSkills),
    i18n: {
      title:      isIntercept
        ? game.i18n.localize("PMTTRPG.Clash.InterceptTitle")
        : game.i18n.localize("PMTTRPG.Clash.RetaliateTitle"),
      evade:      game.i18n.localize("PMTTRPG.Clash.Evade"),
      block:      game.i18n.localize("PMTTRPG.Clash.Block"),
      counter:    game.i18n.localize("PMTTRPG.Clash.Counter"),
      useSkill:   game.i18n.localize("PMTTRPG.Clash.UseSkill"),
      onesided:   game.i18n.localize("PMTTRPG.Clash.OneSided"),
      attackedBy: game.i18n.format("PMTTRPG.Clash.AttackedBy", { name: state.attackerName }),
      outfit:     game.i18n.localize("PMTTRPG.Clash.ChooseOutfit"),
      weapon:     game.i18n.localize("PMTTRPG.Clash.ChooseWeapon"),
      skill:      game.i18n.localize("PMTTRPG.Clash.ChooseSkill"),
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
function _buildRetaliationOptions(weapons, outfits, skills) {
  return [
    ...(outfits.length ? [{
      type: RETALIATION_TYPES.EVADE,
      label: "PMTTRPG.Clash.Evade",
      icon: "systems/projectmoonttrpg/assets/icons/sheet/01_evade",
      requiresItem: true,
      items: outfits,
    }] : []),
    ...(outfits.length ? [{
      type: RETALIATION_TYPES.BLOCK,
      label: "PMTTRPG.Clash.Block",
      icon: "systems/projectmoonttrpg/assets/icons/sheet/01_defense",
      requiresItem: true,
      items: outfits,
    }] : []),
    ...(weapons.length ? [{
      type: RETALIATION_TYPES.COUNTER,
      label: "PMTTRPG.Clash.Counter",
      icon: "systems/projectmoonttrpg/assets/icons/sheet/00_slash",
      requiresItem: true,
      items: weapons,
    }] : []),
    ...(skills.length ? [{
      type: "skill",
      label: "PMTTRPG.Clash.UseSkill",
      icon: "systems/projectmoonttrpg/assets/icons/sheet/00_light",
      requiresItem: true,
      items: skills,
    }] : []),
    {
      type: "onesided",
      label: "PMTTRPG.Clash.OneSided",
      icon: "systems/projectmoonttrpg/assets/icons/sheet/03_danger1",
      requiresItem: false,
    }
  ];
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

  if (!type) return null;

  let item = null;
  if (itemId) {
    item = actor.items.get(itemId) ?? null;
  }

  // For counter/skill, require an item selection.
  if ([RETALIATION_TYPES.COUNTER, "skill"].includes(type) && !item) {
    ui.notifications.warn(game.i18n.localize("PMTTRPG.Clash.NoItemSelected"));
    return null;
  }

  return { type, item };
}

/**
 * Prompt ammo (or dry-fire) for a ranged Counter.
 *
 * @param {ActorPMTTRPG} actor
 * @param {Item} weapon
 * @returns {Promise<{ ammo: Item|null, consumeAmmo: boolean, dryFire: boolean }|null>}
 */
export async function promptRangedCounterAmmo(actor, weapon) {
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
      label: game.i18n.localize("PMTTRPG.Clash.Counter"),
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

/**
 * Wires show/hide of the item picker sub-list based on which option is selected.
 */
function _bindRetaliationDialogListeners(dialog) {
  const el = dialog.element;
  if (!el) return;

  const radios    = el.querySelectorAll("[name='retaliationType']");
  const itemPicker = el.querySelector(".clash-item-picker");

  const refreshPicker = () => {
    const selected = el.querySelector("[name='retaliationType']:checked")?.value;
    const needsItem = [RETALIATION_TYPES.BLOCK, RETALIATION_TYPES.EVADE, RETALIATION_TYPES.COUNTER, "skill"].includes(selected);
    if (itemPicker) itemPicker.style.display = needsItem ? "" : "none";

    // Populate item picker options based on type
    const itemSelect = el.querySelector("[name='retaliationItemId']");
    if (!itemSelect || !needsItem) return;

    const items = el.querySelectorAll(`.clash-item-option[data-type="${selected}"]`);
    itemSelect.innerHTML = "";
    for (const item of items) {
      const opt = document.createElement("option");
      opt.value   = item.dataset.itemId;
      opt.textContent = item.dataset.itemName;
      itemSelect.appendChild(opt);
    }
  };

  for (const radio of radios) {
    radio.addEventListener("change", refreshPicker);
  }

  refreshPicker();
}

function _dialogClasses() {
  const classes = ["projectmoonttrpg", "PMTTRPG-dialog"];
  if (PMTTRPGUtility.nightmode) classes.push("nightmode");
  return classes;
}