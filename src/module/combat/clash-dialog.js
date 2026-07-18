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
 * @property {"evade"|"block"|"counter"|"intercept"} type
 * @property {Item|null} item   — chosen weapon/skill for counter/skill options
 */

import { PMTTRPGUtility } from "../utility.js";
import { RETALIATION_TYPES } from "./clash-state.js";

const { renderTemplate } = foundry.applications.handlebars;

const TEMPLATE_RETALIATION = "systems/projectmoonttrpg/templates/dialog/clash/retaliation-dialog.hbs";

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

  const equippedSkills = actor.items
    .filter(i => i.type === "skill" && i.system?.equipped)
    .map(i => ({ id: i.id, name: i.name, img: i.img, skillType: i.system?.skillType ?? "attack" }));

  const templateData = {
    actor,
    state,
    isIntercept,
    equippedWeapons,
    equippedSkills,
    options: _buildRetaliationOptions(equippedWeapons, equippedSkills),
    i18n: {
      title:      isIntercept
        ? game.i18n.localize("PMTTRPG.Clash.InterceptTitle")
        : game.i18n.localize("PMTTRPG.Clash.RetaliateTitle"),
      evade:      game.i18n.localize("PMTTRPG.Clash.Evade"),
      block:      game.i18n.localize("PMTTRPG.Clash.Block"),
      counter:    game.i18n.localize("PMTTRPG.Clash.Counter"),
      useSkill:   game.i18n.localize("PMTTRPG.Clash.UseSkill"),
      attackedBy: game.i18n.format("PMTTRPG.Clash.AttackedBy", { name: state.attackerName }),
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
function _buildRetaliationOptions(weapons, skills) {
  return [
    {
      type: RETALIATION_TYPES.EVADE,
      label: "PMTTRPG.Clash.Evade",
      icon: "fa-solid fa-wind",
      requiresItem: false,
    },
    {
      type: RETALIATION_TYPES.BLOCK,
      label: "PMTTRPG.Clash.Block",
      icon: "fa-solid fa-shield",
      requiresItem: false,
    },
    ...(weapons.length ? [{
      type: RETALIATION_TYPES.COUNTER,
      label: "PMTTRPG.Clash.Counter",
      icon: "fa-solid fa-sword",
      requiresItem: true,
      items: weapons,
    }] : []),
    ...(skills.length ? [{
      type: "skill",
      label: "PMTTRPG.Clash.UseSkill",
      icon: "fa-solid fa-bolt",
      requiresItem: true,
      items: skills,
    }] : []),
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
 * Wires show/hide of the item picker sub-list based on which option is selected.
 */
function _bindRetaliationDialogListeners(dialog) {
  const el = dialog.element;
  if (!el) return;

  const radios    = el.querySelectorAll("[name='retaliationType']");
  const itemPicker = el.querySelector(".clash-item-picker");

  const refreshPicker = () => {
    const selected = el.querySelector("[name='retaliationType']:checked")?.value;
    const needsItem = [RETALIATION_TYPES.COUNTER, "skill"].includes(selected);
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