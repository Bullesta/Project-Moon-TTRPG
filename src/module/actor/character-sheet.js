import { PMTTRPGUtility } from "../utility.js";
import { PMTTRPGRolls } from "../rolls.js";
import { PMTTRPGTargetingAPI } from "../targeting.js";
import { buildEffectSummaryGroups } from "../effects/effect-summary.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { TextEditor } = foundry.applications.ux;

const TEMPLATE_ROOT = "systems/projectmoonttrpg/templates/sheet/character";

/**
 * Character actor sheet (ApplicationV2).
 * @extends {ActorSheetV2}
 */
export class PMTTRPGCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["projectmoonttrpg", "sheet", "actor", "character"],
    position: { width: 1280, height: 780 },
    window: { resizable: true },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actions: {
      tab: this.prototype._onTabClick,
      editImage: this.prototype._onEditImage,
      rollable: this.prototype._onRollable,
      initiativeRoll: this.prototype._onInitiativeRoll,
      toggleLook: this.prototype._onToggleLook,
      itemCreate: this.prototype._onItemCreate,
      itemEdit: this.prototype._onItemEdit,
      itemDelete: this.prototype._onItemDelete,
      itemEquip: this.prototype._onEquipEquipment,
      showItemDetails: this.prototype._onShowItemDetails,
      toggleDetails: this.prototype._onToggleDetails,
      counterIncrease: this.prototype._onCounterIncrease,
      counterDecrease: this.prototype._onCounterDecrease,
      statusControl: this.prototype._onStatusControl,
    },
    dragDrop: [],
  };

  /** @override */
  static PARTS = {
    header: { template: `${TEMPLATE_ROOT}/header.hbs` },
    sidebar: { template: `${TEMPLATE_ROOT}/sidebar.hbs`, scrollable: [".cell--aesthetics"] },
    main: { template: `${TEMPLATE_ROOT}/main.hbs`, scrollable: [".sheet-body"] },
  };

  tabGroups = {
    primary: "main",
  };

  /** @override */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    if (PMTTRPGUtility.nightmode && !options.classes.includes("nightmode")) {
      options.classes.push("nightmode");
    }
    return options;
  }

  _getTabs() {
    const tabs = {
      "main": { id: "main", group: "primary", label: "PMTTRPG.TabMain", icon: "fa-solid fa-address-card" },
      "weapons-attacks": { id: "weapons-attacks", group: "primary", label: "PMTTRPG.Weapons", icon: "fa-solid fa-gun" },
      "outfits": { id: "outfits", group: "primary", label: "PMTTRPG.Outfits", icon: "fa-solid fa-shirt" },
      "skills": { id: "skills", group: "primary", label: "PMTTRPG.Skills", icon: "fa-solid fa-hand-fist" },
      "bios": { id: "bios", group: "primary", label: "PMTTRPG.Bios", icon: "fa-solid fa-book" },
    };
    for (const tab of Object.values(tabs)) {
      tab.active = this.tabGroups[tab.group] === tab.id;
      tab.cssClass = tab.active ? "active" : "";
    }
    return tabs;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isEditable = this.isEditable;
    const isOwner = this.document.isOwner;

    const actorData = this.actor.toObject(false);
    context.actor = actorData;
    context.system = actorData.system;

    context.items = actorData.items;
    for (const i of context.items) {
      const item = this.actor.items.get(i._id);
      i.labels = item.labels;
    }
    context.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));

    context.enrichmentOptions = {
      async: true,
      documents: true,
      secrets: this.actor.isOwner,
      rollData: this.actor.getRollData(),
      relativeTo: this.actor,
    };

    await this._prepareCharacterItems(context);
    context.allWeapons = context.items
      .filter(item => item.type === "weapon")
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.augments = context.items
      .filter(item => item.type === "augment")
      .map((augment) => {
        const augmentDocument = this.actor.items.get(augment._id);
        if (augmentDocument) {
          augment.system = foundry.utils.mergeObject(
            foundry.utils.duplicate(augment.system ?? {}),
            foundry.utils.duplicate(augmentDocument.system ?? {}),
            { inplace: false }
          );
        }
        try {
          augment.system = augment.system || {};
          augment.system.effectSummaryGroups = buildEffectSummaryGroups(augment.system?.effects ?? []);
        }
        catch (err) { /* ignore */ }
        return augment;
      })
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.augment = context.augments[0] ?? null;
    context.statuses = this._prepareStatusItems(context.items);

    context.system.details.lookEnriched = await TextEditor.enrichHTML(
      context.system.details.look, context.enrichmentOptions
    );
    context.system.isToken = this.actor.token != null;

    context.selects = {
      weaponTypes: { melee: "PMTTRPG.WeaponTypeMelee", ranged: "PMTTRPG.WeaponTypeRanged" },
      outfitProperties: {
        none: "PMTTRPG.OutfitPropertyNone", armored: "PMTTRPG.OutfitPropertyArmored",
        swift: "PMTTRPG.OutfitPropertySwift", balanced: "PMTTRPG.OutfitPropertyBalanced",
      },
      damageTypes: { slash: "PMTTRPG.DamageTypeSlash", pierce: "PMTTRPG.DamageTypePierce", blunt: "PMTTRPG.DamageTypeBlunt" },
      formPropertiesMelee: {
        small: "PMTTRPG.FormPropertySmall", medium: "PMTTRPG.FormPropertyMedium", long: "PMTTRPG.FormPropertyLong",
        sturdy: "PMTTRPG.FormPropertySturdy", hybrid: "PMTTRPG.FormPropertyHybridMelee",
        versatile: "PMTTRPG.FormPropertyVersatile", innate: "PMTTRPG.FormPropertyInnateMelee",
      },
      formPropertiesRanged: {
        lowCaliber: "PMTTRPG.FormPropertyLowCaliber", highCaliber: "PMTTRPG.FormPropertyHighCaliber",
        reactive: "PMTTRPG.FormPropertyReactive", hybrid: "PMTTRPG.FormPropertyHybridRanged",
        recoil: "PMTTRPG.FormPropertyRecoil", innate: "PMTTRPG.FormPropertyInnateRanged",
      },
      handPropertiesMelee: {
        off1h: "PMTTRPG.HandPropertyOff1H", off2h: "PMTTRPG.HandPropertyOff2H",
        def1h: "PMTTRPG.HandPropertyDef1H", def2h: "PMTTRPG.HandPropertyDef2H",
      },
      handPropertiesRanged: { off1h: "PMTTRPG.HandPropertyOff1H", off2h: "PMTTRPG.HandPropertyOff2H" },
      ammoTypes: { standard: "PMTTRPG.AmmoStandard", specialized: "PMTTRPG.AmmoSpecialized" },
      skillTypes: {
        attack: "PMTTRPG.SkillTypeAttack", block: "PMTTRPG.SkillTypeBlock",
        evade: "PMTTRPG.SkillTypeEvade", stat: "PMTTRPG.SkillTypeStatUse",
      },
    };

    context.cssClass = isEditable ? "editable" : "locked";
    context.editable = isEditable;
    context.owner = isOwner;
    context.limited = this.document.limited;
    context.options = this.options;
    context.flags = this.document.flags;
    context.rollData = this.actor.getRollData();
    context.tabs = this._getTabs();

    return context;
  }

  async _prepareCharacterItems(sheetData) {
    const enrichmentOptions = {
      async: true,
      documents: true,
      secrets: this.actor.isOwner,
      rollData: this.actor.getRollData(),
    };

    const weapons = [];
    const outfits = [];
    const ammunition = [];
    const skills = [];

    for (const i of sheetData.items) {
      const item = this.actor.items.get(i._id);
      enrichmentOptions.relativeTo = item;
      enrichmentOptions.rollData = item.getRollData();
      if (i.system?.description) {
        i.system.descriptionEnriched = await TextEditor.enrichHTML(i.system.description, enrichmentOptions);
      }

      i.img = i.img || foundry.documents.BaseActor.DEFAULT_ICON;
      if (i.type === "weapon") {
        weapons.push(i);
      }
      else if (i.type === "outfit") {
        outfits.push(i);
      }
      else if (i.type === "ammunition") {
        ammunition.push(i);
      }
      else if (i.type === "skill") {
        skills.push(i);
      }
    }

    sheetData.outfits = outfits;
    sheetData.ammunition = ammunition;
    sheetData.skills = skills;

    const buildGroupsFor = (item) => {
      try {
        item.system = item.system || {};
        item.system.effectSummaryGroups = buildEffectSummaryGroups(item.system?.effects ?? []);
      }
      catch (err) { /* ignore */ }
    };
    for (const w of weapons) buildGroupsFor(w);
    for (const o of outfits) buildGroupsFor(o);

    const equippedWeapon = this.actor.items.find(i => i.type === "weapon" && i.system?.equipped)
      || this.actor.items.find(i => i.type === "weapon");
    const equippedOutfit = this.actor.items.find(i => i.type === "outfit" && i.system?.equipped)
      || this.actor.items.find(i => i.type === "outfit");

    for (const s of skills) {
      s.equippedWeaponDamageType = equippedWeapon?.system?.damageType || null;
      s.equippedWeaponOffensiveDiceComputed = equippedWeapon?.system?.offensiveDiceComputed || null;
      s.equippedOutfitBlockDiceComputed = equippedOutfit?.system?.blockDiceComputed || null;
      s.equippedOutfitEvadeDiceComputed = equippedOutfit?.system?.evadeDiceComputed || null;
      s.system.stat = s.system.stat || "for";
    }
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    if (!this.isEditable) return;

    const root = this.element;

    this._sortDragAbort?.abort();
    this._sortDragAbort = new AbortController();
    const { signal } = this._sortDragAbort;

    this._bindSortDragDrop(root, signal);

    if (this._pendingItemExpansionState) {
      this._restoreItemExpansionState(root, this._pendingItemExpansionState);
      this._pendingItemExpansionState = null;
    }


    for (const el of root.querySelectorAll("[data-action=counterIncrease]")) {
      el.addEventListener("contextmenu", (event) => this._onCounterDecrease(event, el), { signal });
    }

    root.addEventListener("dragover", (event) => {
      if (event.dataTransfer?.types?.includes("text/plain")) event.preventDefault();
    }, { signal });

    root.addEventListener("drop", (event) => this._onDrop(event), { signal });
  }

  _onTabClick(event, target) {
    event.preventDefault();
    const group = target.dataset.group ?? "primary";
    const tabId = target.dataset.tab;
    if (!tabId || this.tabGroups[group] === tabId) return;
    this.tabGroups[group] = tabId;
    for (const el of this.element.querySelectorAll(`[data-group="${group}"][data-tab]`)) {
      el.classList.toggle("active", el.dataset.tab === tabId);
    }
  }

  _itemIdFor(target) {
    return target?.dataset?.itemId ?? target?.closest(".item")?.dataset?.itemId ?? null;
  }

  async _onRollable(event, target) {
    event.preventDefault();
    const data = target.dataset;
    const itemId = this._itemIdFor(target);
    const item = itemId ? this.actor.items.get(itemId) : null;
    let templateData = {};

    if (target.classList.contains("ability-rollable") && data.roll) {
      const flavorText = data.label;
      templateData = { title: flavorText };
      return PMTTRPGRolls.doStatRoll({ actor: this.actor, stat: data.roll, label: flavorText, templateData });
    }
    else if (item?.type === "outfit" && data.roll) {
      return item.roll({ mode: data.rollType || "block" });
    }
    else if (item?.type === "weapon" && data.ammoId) {
      const ammo = this.actor.items.get(data.ammoId);
      return item.roll({ ammo });
    }
    else if (item) {
      return item.roll();
    }
  }

  async _onInitiativeRoll(event) {
    event.preventDefault();
    const form = this.element;
    const macroMisc = Number(form?.querySelector('input[name="flags.projectmoonttrpg.initiative.macroMisc"]')?.value ?? 0) || 0;
    const manualMisc = Number(form?.querySelector('input[name="flags.projectmoonttrpg.initiative.manualMisc"]')?.value ?? 0) || 0;
    await PMTTRPGTargetingAPI.rollInitiative(this.actor, { macroMisc, manualMisc });
  }

  async _onEditImage(event, target) {
    event.preventDefault();
    const attr = target.dataset.edit || "img";
    const current = foundry.utils.getProperty(this.document, attr);
    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current,
      callback: (path) => this.document.update({ [attr]: path }),
      position: { top: (this.position.top ?? 0) + 40, left: (this.position.left ?? 0) + 10 },
    });
    return fp.browse();
  }

  async _onToggleLook(event, target) {
    event.preventDefault();
    const look = this.element.querySelector(".sheet-look");
    look?.classList.toggle("closed");
    target.classList.toggle("closed");
    await this.actor.update({ "flags.projectmoonttrpg.sheetDisplay.sidebarClosed": !!look?.classList.contains("closed") });
  }

  async _onItemCreate(event, target) {
    event.preventDefault();
    const type = target.dataset.type;
    if (type === "augment" && this.actor.items.some(item => item.type === "augment")) {
      ui.notifications.warn(game.i18n.localize("PMTTRPG.AugmentOnlyOne"));
      return;
    }
    const data = foundry.utils.duplicate(target.dataset);
    const itemName = data.name || game.i18n.localize(`TYPES.Item.${type}`) || type;
    const itemData = { name: itemName, type, system: data };
    delete itemData.system["type"];
    await this.actor.createEmbeddedDocuments("Item", [itemData], {});
  }

  _onItemEdit(event, target) {
    event.preventDefault();
    const itemId = this._itemIdFor(target);
    const item = itemId ? this.actor.items.get(itemId) : null;
    item?.sheet.render(true);
  }

  async _onItemDelete(event, target) {
    event.preventDefault();
    const itemId = this._itemIdFor(target);
    const item = itemId ? this.actor.items.get(itemId) : null;
    await item?.delete();
  }

  async _onEquipEquipment(event, target) {
    event.preventDefault();
    const itemId = this._itemIdFor(target);
    const item = itemId ? this.actor.items.get(itemId) : null;
    if (!item) return;
    await item.update({ "system.equipped": !item.system.equipped }, {});
  }

  _onShowItemDetails(event, target) {
    if (this._shouldSuppressItemToggleClick()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    target.classList.toggle("open");
    target.closest(".item")?.classList.toggle("open");
  }

  _onToggleDetails(event, target) {
    if (this._shouldSuppressItemToggleClick()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    target.closest(".item")?.classList.toggle("collapsed");
  }

  _shouldSuppressItemToggleClick() {
    return !!this._suppressItemToggleClick;
  }

  _captureItemExpansionState(root) {
    const state = new Map();
    for (const li of root.querySelectorAll(".items-list .item[data-item-id]")) {
      state.set(li.dataset.itemId, {
        collapsed: li.classList.contains("collapsed"),
        open: li.classList.contains("open"),
        labelOpen: li.querySelector(".item-label")?.classList.contains("open") ?? false,
      });
    }
    return state;
  }

  _restoreItemExpansionState(root, state) {
    for (const li of root.querySelectorAll(".items-list .item[data-item-id]")) {
      const saved = state.get(li.dataset.itemId);
      if (!saved) continue;
      li.classList.toggle("collapsed", saved.collapsed);
      li.classList.toggle("open", saved.open);
      li.querySelector(".item-label")?.classList.toggle("open", saved.labelOpen);
    }
  }

  _suppressItemToggleClickFor(duration = 250) {
    this._suppressItemToggleClick = true;
    window.clearTimeout(this._suppressItemToggleClickTimer);
    this._suppressItemToggleClickTimer = window.setTimeout(() => {
      this._suppressItemToggleClick = false;
      this._suppressItemToggleClickTimer = null;
    }, duration);
  }

  _onCounterIncrease(event, target) { return this._adjustCounter(event, target, "increase"); }

  _onCounterDecrease(event, target) { return this._adjustCounter(event, target, "decrease"); }

  async _adjustCounter(event, target, changeType) {
    event.preventDefault();
    const counter = target.dataset.counter;
    const itemId = this._itemIdFor(target);
    const item = itemId ? this.actor.items.get(itemId) : null;
    if (!counter || !item) return;

    const offset = changeType === "increase" ? 1 : -1;
    const update = {};
    if (counter === "uses") update["system.uses"] = Math.max(0, Number(item.system?.uses ?? 0) + offset);
    else if (counter === "quantity") update["system.quantity"] = Math.max(0, Number(item.system?.quantity ?? 0) + offset);
    else return;

    await item.update(update, {});
  }

  async _onStatusControl(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const li = target.closest(".item");
    const action = target.dataset.control;
    const statusKey = li?.dataset?.statusKey;
    const statusItems = this.actor.items.filter(item => item.type === "status" && this._statusKey(item) === statusKey);
    const item = statusItems[0];
    if (!item) return;

    if (action === "increase") {
      const itemData = foundry.utils.duplicate(item.toObject());
      delete itemData._id; delete itemData.id; delete itemData.uuid;
      await this.actor.createEmbeddedDocuments("Item", [itemData], {});
    }
    else if (action === "decrease") {
      if (statusItems.length <= 1) await item.delete();
      else await statusItems[statusItems.length - 1].delete();
    }
    else if (action === "remove") {
      await this.actor.deleteEmbeddedDocuments("Item", statusItems.map(s => s.id));
    }
  }

  _statusKey(item) {
    return `${item?.name ?? ""}`.trim().toLowerCase();
  }

  _prepareStatusItems(items = []) {
    const grouped = new Map();
    for (const item of items) {
      if (item.type !== "status") continue;
      const key = this._statusKey(item) || item.id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          key, name: item.name, img: item.img, count: 0, items: [],
          representative: item, system: foundry.utils.duplicate(item.system),
        });
      }
      const group = grouped.get(key);
      group.count += 1;
      group.items.push(item);
      group.representative = group.representative ?? item;
      group.img = group.img || item.img;
      group.system.descriptionEnriched = group.system.descriptionEnriched || item.system?.descriptionEnriched || "";
    }
    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  _bindSortDragDrop(root, signal) {
    const sortableSelector = ".items-list .item.item--weapon, .items-list .item.item--outfit, .items-list .item.item--skill";

    for (const li of root.querySelectorAll(sortableSelector)) {
      li.setAttribute("draggable", "false");
      li.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }, { signal });
      li.addEventListener("drop", (event) => this._onSortDrop(event, li), { signal });
    }

    for (const grip of root.querySelectorAll(".items-list .item .item-sort")) {
      grip.setAttribute("draggable", "true");
      grip.addEventListener("dragstart", (event) => this._onSortDragStart(event), { signal });
      grip.addEventListener("dragend", () => {
        grip.closest(".item")?.classList.remove("dragging");
        this._suppressItemToggleClickFor();
      }, { signal });
      grip.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      }, { signal });
    }
  }

  _onSortDragStart(event) {
    this._suppressItemToggleClickFor();
    const grip = event.currentTarget;
    const li = grip.closest(".item");
    const itemId = li?.dataset?.itemId;
    const item = itemId ? this.actor.items.get(itemId) : null;
    if (!item) {
      event.preventDefault();
      return;
    }
    li.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
    if (li) event.dataTransfer.setDragImage(li, 24, 24);
  }

  async _onSortDrop(event, targetRow) {
    event.preventDefault();
    event.stopPropagation();
    this._suppressItemToggleClickFor();

    const rawData = event.dataTransfer?.getData("text/plain");
    if (!rawData) return false;

    let dropData = null;
    try { dropData = JSON.parse(rawData); }
    catch (err) { return false; }
    if (dropData?.type !== "Item") return false;

    const droppedItem = await Item.fromDropData(dropData);
    const targetItem = this.actor.items.get(targetRow.dataset.itemId);
    if (!droppedItem || !targetItem) return false;
    if (droppedItem.parent?.id !== this.actor.id) return false;
    if (!["weapon", "outfit", "skill"].includes(droppedItem.type)) return false;
    if (droppedItem.type !== targetItem.type) return false;

    return this._sortItems(droppedItem, targetItem);
  }

  /** @override */
  async _onDrop(event) {
    const rawData = event.dataTransfer?.getData("text/plain");
    if (!rawData) return false;

    let dropData = null;
    try { dropData = JSON.parse(rawData); }
    catch (err) { return false; }
    if (dropData?.type !== "Item") return false;

    const droppedItem = await Item.fromDropData(dropData);
    if (!droppedItem) return false;
    if (droppedItem.parent?.id === this.actor.id) return false;
    if (droppedItem.type !== "status" && droppedItem.type !== "augment") return false;
    if (droppedItem.type === "augment" && this.actor.items.some(item => item.type === "augment")) {
      ui.notifications.warn(game.i18n.localize("PMTTRPG.AugmentOnlyOne"));
      return false;
    }

    event.preventDefault();
    const itemData = foundry.utils.duplicate(droppedItem.toObject());
    delete itemData._id; delete itemData.id; delete itemData.uuid;
    itemData.system = foundry.utils.duplicate(itemData.system ?? {});
    await this.actor.createEmbeddedDocuments("Item", [itemData], {});
    return false;
  }

  async _sortItems(draggedItem, targetItem) {
    if (draggedItem.id === targetItem.id) return false;
    this._pendingItemExpansionState = this._captureItemExpansionState(this.element);
    const list = this.actor.items
      .filter(item => item.type === draggedItem.type)
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const draggedIndex = list.findIndex(item => item.id === draggedItem.id);
    const targetIndex = list.findIndex(item => item.id === targetItem.id);
    if (draggedIndex === -1 || targetIndex === -1) return false;
    list.splice(draggedIndex, 1);
    list.splice(targetIndex, 0, draggedItem);
    const updates = list.map((item, index) => ({ _id: item.id, sort: index * 100000 }));
    await this.actor.updateEmbeddedDocuments("Item", updates);
    return false;
  }
}
