import { PMTTRPGUtility } from "../utility.js";
import { PMTTRPGRolls } from "../rolls.js";
import { PMTTRPGTargetingAPI } from "../targeting.js";
import { buildEffectSummaryGroups } from "../effects/effect-summary.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { TextEditor } = foundry.applications.ux;

const TEMPLATE_ROOT = "systems/projectmoonttrpg/templates/sheet/character";
const ASSET_PATH = "systems/projectmoonttrpg/assets/icons/sheet";

const ABILITY_DEFS = [
  { key: "for", id: "fortitude", rollKey: "for" },
  { key: "pru", id: "prudence", rollKey: "pru" },
  { key: "jus", id: "justice", rollKey: "jus" },
  { key: "cha", id: "charm", rollKey: "cha" },
  { key: "ins", id: "insight", rollKey: "ins" },
  { key: "tem", id: "temperance", rollKey: "tem" },
];

const TRACKER_DEFS = [
  { key: "hp", attr: "hp", icon: "HPicon.webp", labelKey: "PMTTRPG.TrackerHP" },
  { key: "st", attr: "st", icon: "01_stagger.webp", labelKey: "PMTTRPG.TrackerST" },
  { key: "sp", attr: "sp", icon: "00_sanity.webp", labelKey: "PMTTRPG.TrackerSP" },
  { key: "lt", attr: "light", icon: "00_light.webp", labelKey: "PMTTRPG.TrackerLT" },
];

const DAMAGE_TYPES = ["slash", "pierce", "blunt"];

export class PMTTRPGCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  #editMode = false;
  #expanded = new Set();
  #dustRaf = null;
  #pendingChangeField = null;
  #pendingUIState = null;
  #panelFxEl = null;

  static SUBMIT_BLOCKLIST = new Set([
    "system.attributes.attackModifier.value",
    "system.attributes.blockModifier.value",
    "system.attributes.evadeModifier.value",
    "system.attributes.rank.value",
    "system.attributes.hp.maxBase",
    "system.attributes.st.maxBase",
    "system.attributes.sp.maxBase",
    "system.attributes.light.maxBase",
    "system.attributes.equipmentRankLimit.value",
    "system.attributes.toolSlots.value",
    "flags.projectmoonttrpg.initiative.macroMisc",
    "img",
  ]);

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["sheet", "actor", "character-sheet-prototype"],
    position: { width: 872, height: 862 },
    window: { resizable: true, contentClasses: ["pm-sheet-body"] },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actions: {
      tab: PMTTRPGCharacterSheet.prototype._onTabClick,
      editImage: PMTTRPGCharacterSheet.prototype._onEditImage,
      rollable: PMTTRPGCharacterSheet.prototype._onRollable,
      initiativeRoll: PMTTRPGCharacterSheet.prototype._onInitiativeRoll,
      toggleEdit: PMTTRPGCharacterSheet.prototype._onToggleEdit,
      toggleTracker: PMTTRPGCharacterSheet.prototype._onToggleTracker,
      itemCreate: PMTTRPGCharacterSheet.prototype._onItemCreate,
      itemEdit: PMTTRPGCharacterSheet.prototype._onItemEdit,
      itemDelete: PMTTRPGCharacterSheet.prototype._onItemDelete,
      itemEquip: PMTTRPGCharacterSheet.prototype._onEquipEquipment,
      toggleDetails: PMTTRPGCharacterSheet.prototype._onToggleDetails,
      counterIncrease: PMTTRPGCharacterSheet.prototype._onCounterIncrease,
      counterDecrease: PMTTRPGCharacterSheet.prototype._onCounterDecrease,
      statusControl: PMTTRPGCharacterSheet.prototype._onStatusControl,
    },
  };

  /** @override */
  static PARTS = {
    sheet: {
      template: `${TEMPLATE_ROOT}/sheet.hbs`,
      scrollable: [".pm-sheet__left", ".tab-content.active"],
    },
  };

  tabGroups = {
    primary: "combat",
  };

  /** @override */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    const strip = new Set(["nightmode", "projectmoonttrpg", "character"]);
    options.classes = options.classes.filter(c => !strip.has(c));
    return options;
  }

  _getTabs() {
    const defs = [
      { id: "combat", labelKey: "PMTTRPG.TabCombat" },
      { id: "skills", labelKey: "PMTTRPG.Skills" },
      { id: "equipment", labelKey: "PMTTRPG.Equipment" },
      { id: "augment", labelKey: "PMTTRPG.Augment" },
      { id: "bio", labelKey: "PMTTRPG.TabBio" },
    ];
    const tabs = {};
    for (const def of defs) {
      tabs[def.id] = {
        id: def.id,
        group: "primary",
        label: game.i18n.localize(def.labelKey),
        active: this.tabGroups.primary === def.id,
        cssClass: this.tabGroups.primary === def.id ? "active" : "",
      };
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

    context.system.isToken = this.actor.token != null;
    if (!context.system.isToken) {
      context.system.xpSvg = PMTTRPGUtility.getProgressCircle({
        current: Number(context.system.attributes.xp.value),
        max: Number(context.system.attributes.xp.max),
        radius: 16,
      });
    }
    else {
      context.system.xpSvg = { radius: 16, circumference: 100, offset: 100 };
    }

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

    context.editMode = this.#editMode;
    context.locked = !(context.editable && this.#editMode);
    context.assetPath = ASSET_PATH;
    context.profileHeader = this._buildProfileHeader(context.system.attributes ?? {});
    context.trackers = TRACKER_DEFS.map(def => this._buildTracker(def, context.system.attributes?.[def.attr]));
    context.resistRows = this._buildResistanceRows();
    context.rollableAttributes = ABILITY_DEFS.map(def => ({
      ...def,
      icon: `${ASSET_PATH}/02_${def.id}.webp`,
      value: context.system.abilities?.[def.key]?.value ?? 0,
      label: context.system.abilities?.[def.key]?.label ?? def.key.toUpperCase(),
      name: `system.abilities.${def.key}.value`,
    }));

    context.equippedWeapons = (context.allWeapons ?? []).filter(w => w.system?.equipped);
    context.equippedOutfits = (context.outfits ?? []).filter(o => o.system?.equipped);

    return context;
  }

  _buildProfileHeader(attrs) {
    const currentExp = Number(attrs.xp?.value) || 0;
    const maxExp = Math.max(1, Number(attrs.xp?.max) || 8);

    return {
      rank: Number(attrs.rank?.value) || 0,
      level: Number(attrs.level?.value) || 0,
      currentExp,
      maxExp,
      expFillPct: Math.min(100, Math.max(0, (currentExp / maxExp) * 100)),
    };
  }

  _buildTracker(def, data = {}) {
    const value = Number(data.value) || 0;
    const isLight = def.key === "lt";
    const temp = isLight ? 0 : (Number(data.temp) || 0);
    const maxBase = Number(data.maxBase) || 0;
    const maxMisc = Number(data.maxMisc) || 0;
    const effMax = Number(data.max) || (maxBase + maxMisc);
    const bar = this._computeTrackerBar(value, temp, effMax, isLight);
    const segs = isLight ? Math.max(1, Math.min(16, effMax)) : null;
    const curLen = Math.max(1, String(value).length);
    const curWidth = Math.max(40, curLen * 18 + 14);
    const short = game.i18n.localize(def.labelKey);
    const detailLabels = isLight
      ? {
        a: game.i18n.localize("PMTTRPG.MaxLight"),
        b: game.i18n.localize("PMTTRPG.BonusMaxLight"),
      }
      : {
        a: game.i18n.format("PMTTRPG.TrackerTemp", { tracker: short }),
        b: game.i18n.format("PMTTRPG.TrackerMax", { tracker: short }),
        c: game.i18n.format("PMTTRPG.TrackerBonusMax", { tracker: short }),
      };

    return {
      key: def.key,
      attr: def.attr,
      short,
      icon: `${ASSET_PATH}/${def.icon}`,
      isLight,
      open: this.#editMode || this.#expanded.has(def.key),
      value,
      temp: bar.temp,
      maxBase,
      maxMisc,
      effMax,
      pct: bar.fillPct,
      shieldLeftPct: bar.shieldLeftPct,
      shieldWidthPct: bar.shieldWidthPct,
      hasTemp: bar.shieldAmt > 0,
      segs,
      curWidth,
      valueName: `system.attributes.${def.attr}.value`,
      tempName: `system.attributes.${def.attr}.temp`,
      maxBaseName: `system.attributes.${def.attr}.maxBase`,
      maxMiscName: `system.attributes.${def.attr}.maxMisc`,
      detailLabels,
      showTemp: !isLight,
      ariaCurrent: game.i18n.format("PMTTRPG.TrackerAriaCurrent", { tracker: short }),
      ariaTemp: game.i18n.format("PMTTRPG.TrackerAriaTemp", { tracker: short }),
      ariaMax: game.i18n.format("PMTTRPG.TrackerAriaMax", { tracker: short }),
      ariaBonusMax: game.i18n.format("PMTTRPG.TrackerAriaBonusMax", { tracker: short }),
      ariaToggle: game.i18n.format("PMTTRPG.TrackerAriaToggle", { tracker: short }),
    };
  }

  _computeTrackerBar(value, temp, effMax, isLight = false) {
    let v = Math.max(0, value);
    let t = Math.max(0, temp);
    const max = Math.max(0, effMax);

    if (isLight) {
      v = Math.min(v, 16);
    }

    if (max <= 0) {
      return { fillPct: 0, shieldLeftPct: 0, shieldWidthPct: 0, shieldAmt: 0, temp: t };
    }

    if (t <= 0) {
      return {
        fillPct: Math.min(100, (v / max) * 100),
        shieldLeftPct: 0,
        shieldWidthPct: 0,
        shieldAmt: 0,
        temp: 0,
      };
    }

    if (v + t <= max) {
      const fillPct = (v / max) * 100;
      const shieldWidthPct = (t / max) * 100;
      return {
        fillPct,
        shieldLeftPct: Math.max(0, fillPct - shieldWidthPct),
        shieldWidthPct,
        shieldAmt: t,
        temp: t,
      };
    }

    const total = v + t;
    const shieldWidthPct = (t / total) * 100;
    return {
      fillPct: 100,
      shieldLeftPct: 100 - shieldWidthPct,
      shieldWidthPct,
      shieldAmt: t,
      temp: t,
    };
  }

  _buildResistanceRows() {
    const outfit = this.actor.items.find(i => i.type === "outfit" && i.system?.equipped);
    const display = outfit?.system?.resistancesDisplay;

    const buildRow = (pool, key, title) => ({
      key,
      title,
      tiles: DAMAGE_TYPES.map(dmg => ({
        dmg,
        icon: `${ASSET_PATH}/00_${dmg}.webp`,
        value: display?.[pool]?.[dmg] ?? "1x",
      })),
    });

    return [
      buildRow("hp", "hp-resist", game.i18n.localize("PMTTRPG.HPResistances")),
      buildRow("st", "st-resist", game.i18n.localize("PMTTRPG.STResistances")),
    ];
  }

  _onToggleEdit(event, target) {
    event.preventDefault();
    this.#editMode = !!target.checked;
    if (this.#editMode) this.#expanded.clear();
    this.render(false);
  }

  _onToggleTracker(event, target) {
    event.preventDefault();
    const key = target.dataset.tracker;
    if (!key) return;
    if (this.#expanded.has(key)) this.#expanded.delete(key);
    else this.#expanded.add(key);
    const tracker = target.closest(".tracker");
    tracker?.classList.toggle("open", this.#expanded.has(key));
    target.setAttribute("aria-expanded", this.#expanded.has(key) ? "true" : "false");
  }

  /** @override */
  _onChangeForm(formConfig, event) {
    const target = this._resolveFormField(event);
    this.#pendingChangeField = target?.name ?? null;
    return super._onChangeForm(formConfig, event);
  }

  /** @override */
  _prepareSubmitData(event, form, formData, updateData) {
    const name = this.#pendingChangeField;
    this.#pendingChangeField = null;

    if (!name || this.constructor.SUBMIT_BLOCKLIST.has(name)) return {};

    if (!(name in formData.object)) return {};

    const newValue = formData.object[name];
    const current = foundry.utils.getProperty(this.document, name);
    if (this._isSameFormValue(newValue, current)) return {};

    const update = foundry.utils.expandObject({ [name]: newValue });
    delete update.img;
    return update;
  }

  _resolveFormField(event) {
    if (!(event.target instanceof HTMLElement)) return null;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    for (const el of path) {
      if (el instanceof HTMLElement && el.name) return el;
    }
    return event.target.closest("[name]");
  }

  _isSameFormValue(newValue, current) {
    if (newValue === current) return true;
    if (typeof newValue === "string" && typeof current === "number" && newValue.trim() !== "") {
      return Number(newValue) === current;
    }
    return false;
  }

  /** @override */
  render(...args) {
    if (this.element) {
      this.#pendingUIState = this._captureUIState();
      const fx = this.element.querySelector(".panel-fx");
      if (fx) {
        this.#panelFxEl = fx;
        fx.remove();
      }
    }
    return super.render(...args);
  }

  _captureUIState() {
    const root = this.element;
    if (!root) return null;

    const tabFromDom = root.querySelector('.tabbar [data-tab].active')?.dataset.tab;
    if (tabFromDom) this.tabGroups.primary = tabFromDom;

    return {
      items: this._captureItemExpansionState(root),
      tab: this.tabGroups.primary ?? "combat",
      scrollTop: root.querySelector(".tab-content.active")?.scrollTop ?? 0,
      leftScrollTop: root.querySelector(".pm-sheet__left")?.scrollTop ?? 0,
    };
  }

  _rehomePanelFx() {
    const panel = this.element?.querySelector(".tab-panel");
    if (!panel) return false;

    if (this.#panelFxEl) {
      this.#panelFxEl.querySelector(".fx-grain")?.remove();
      const incoming = panel.querySelector(".panel-fx");
      if (incoming && incoming !== this.#panelFxEl) {
        if (!this.#panelFxEl.querySelector(".fx-scan")) {
          const incomingScan = incoming.querySelector(".fx-scan");
          if (incomingScan) this.#panelFxEl.querySelector(".fx-stains")?.after(incomingScan.cloneNode(true));
        }
        incoming.replaceWith(this.#panelFxEl);
      } else if (!panel.contains(this.#panelFxEl)) {
        panel.prepend(this.#panelFxEl);
      }
      this._attachDustResize(panel);
      return true;
    }

    this.#panelFxEl = panel.querySelector(".panel-fx");
    return false;
  }

  _attachDustResize(panel = this.element?.querySelector(".tab-panel")) {
    const cv = this.#panelFxEl?.querySelector(".fx-dust") ?? panel?.querySelector(".fx-dust");
    if (!cv || !panel) return;

    const resize = () => {
      const w = Math.max(1, panel.clientWidth);
      const h = Math.max(1, panel.clientHeight);
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
    };

    resize();
    this._dustResizeObserver?.disconnect();
    this._dustResizeObserver = new ResizeObserver(resize);
    this._dustResizeObserver.observe(panel);
  }

  _restoreUIState(state) {
    const root = this.element;
    if (!root || !state) return;

    if (state.items) this._restoreItemExpansionState(root, state.items);

    if (state.tab) {
      this.tabGroups.primary = state.tab;
      for (const el of root.querySelectorAll('[data-group="primary"][data-tab]')) {
        el.classList.toggle("active", el.dataset.tab === state.tab);
      }
    }

    requestAnimationFrame(() => {
      root.querySelector(".tab-content.active")?.scrollTo({ top: state.scrollTop ?? 0 });
      root.querySelector(".pm-sheet__left")?.scrollTo({ top: state.leftScrollTop ?? 0 });
    });
  }

  _syncLockedState(context) {
    const root = this.element;
    if (!root) return;
    root.classList.toggle("pm-locked", !!context.locked);
    if (this.#editMode) {
      for (const tr of root.querySelectorAll(".tracker")) {
        tr.classList.add("open");
        tr.querySelector(".chev")?.setAttribute("aria-expanded", "true");
      }
    }
  }

  _stopDust() {
    if (this.#dustRaf) cancelAnimationFrame(this.#dustRaf);
    this.#dustRaf = null;
    this._dustResizeObserver?.disconnect();
    this._dustResizeObserver = null;
  }

  _startDust() {
    this._stopDust();
    const panel = this.element?.querySelector(".tab-panel");
    const cv = this.#panelFxEl?.querySelector(".fx-dust") ?? panel?.querySelector(".fx-dust");
    if (!cv || !panel) return;

    this._attachDustResize(panel);

    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let motes = [];
    const seedMotes = () => {
      const W = cv.width;
      const H = cv.height;
      motes = Array.from({ length: 34 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.5 + Math.random() * 1.3,
        a: 0.02 + Math.random() * 0.08,
        vx: -0.04 + Math.random() * 0.08,
        vy: -0.08 - Math.random() * 0.12,
        ph: Math.random() * Math.PI * 2,
      }));
    };
    seedMotes();

    const draw = (t) => {
      const W = cv.width;
      const H = cv.height;
      ctx.clearRect(0, 0, W, H);
      for (const m of motes) {
        const alpha = m.a * (0.7 + 0.3 * Math.sin(t / 900 + m.ph));
        ctx.fillStyle = `rgba(216,190,130,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(0);
      return;
    }

    let last = 0;
    const frame = (t) => {
      this.#dustRaf = requestAnimationFrame(frame);
      if (t - last < 33) return;
      const dt = Math.min(t - last, 100) / 16.7;
      last = t;
      const W = cv.width;
      const H = cv.height;
      for (const m of motes) {
        m.x += (m.vx + Math.sin(t / 4000 + m.ph) * 0.05) * dt;
        m.y += m.vy * dt;
        if (m.y < -3) { m.y = H + 3; m.x = Math.random() * W; }
        if (m.x < -3) m.x = W + 3;
        if (m.x > W + 3) m.x = -3;
      }
      draw(t);
    };
    this.#dustRaf = requestAnimationFrame(frame);
  }

  /** @override */
  async close(options = {}) {
    this._stopDust();
    this.#panelFxEl = null;
    return super.close(options);
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
    for (const s of skills) buildGroupsFor(s);

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

    if (this.isEditable) {
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
    }

    if (this.#pendingUIState) {
      this._restoreUIState(this.#pendingUIState);
      this.#pendingUIState = null;
    }
    this._syncLockedState(context);
    const preservedFx = this._rehomePanelFx();
    if (!preservedFx || !this.#dustRaf) this._startDust();
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
    if (target.classList.contains("ability-rollable") && this.#editMode) {
      event.preventDefault();
      return;
    }
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
    const macroMisc = Number(this.actor.flags?.projectmoonttrpg?.initiative?.macroMisc ?? 0) || 0;
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

  async _onItemCreate(event, target) {
    event.preventDefault();
    const type = target.dataset.type;
    if (type === "augment" && this.actor.items.some(item => item.type === "augment")) {
      ui.notifications.warn(game.i18n.localize("PMTTRPG.AugmentOnlyOne"));
      return;
    }
    const data = foundry.utils.duplicate(target.dataset);
    const itemName = data.name || game.i18n.localize(`TYPES.Item.${type}`) || type;
    delete data.action;
    delete data.type;
    delete data.name;
    const itemData = { name: itemName, type, system: data };
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

  _onToggleDetails(event, target) {
    if (this._shouldSuppressItemToggleClick()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    const li = target.closest(".item");
    li?.classList.toggle("collapsed");
    const expanded = li && !li.classList.contains("collapsed");
    target.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  _shouldSuppressItemToggleClick() {
    return !!this._suppressItemToggleClick;
  }

  _captureItemExpansionState(root) {
    const state = new Map();
    for (const li of root.querySelectorAll(".items-list .item[data-item-id]")) {
      state.set(li.dataset.itemId, {
        collapsed: li.classList.contains("collapsed"),
      });
    }
    return state;
  }

  _restoreItemExpansionState(root, state) {
    for (const li of root.querySelectorAll(".items-list .item[data-item-id]")) {
      const saved = state.get(li.dataset.itemId);
      if (!saved) continue;
      li.classList.toggle("collapsed", saved.collapsed);
      const expanded = !saved.collapsed;
      for (const toggle of li.querySelectorAll(".item-toggle-details")) {
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      }
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
    event.stopPropagation();
    const counter = target.dataset.counter;
    const itemId = this._itemIdFor(target);
    const item = itemId ? this.actor.items.get(itemId) : null;
    if (!counter || !item) return;

    const offset = changeType === "increase" ? 1 : -1;
    const update = {};
    if (counter === "uses") update["system.uses"] = Math.max(0, Number(item.system?.uses ?? 0) + offset);
    else if (counter === "quantity") update["system.quantity"] = Math.max(0, Number(item.system?.quantity ?? 0) + offset);
    else return;

    await item.update(update, { render: false });
    this._syncCounterDisplay(itemId, counter, Object.values(update)[0]);
  }

  _syncCounterDisplay(itemId, counter, value) {
    if (!this.element || counter !== "quantity") return;
    const countEl = this.element.querySelector(`.item[data-item-id="${itemId}"] .item-count`);
    if (countEl) countEl.textContent = `×${value}`;
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
      const key = this._statusKey(item) || item._id || item.id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          name: item.name,
          img: item.img,
          count: 0,
          items: [],
          representative: item,
          system: foundry.utils.duplicate(item.system ?? {}),
        });
      }
      const group = grouped.get(key);
      group.count += 1;
      group.items.push(item);
      group.representative = group.representative ?? item;
      group.img = group.img || item.img;
      if (!group.system.descriptionEnriched && item.system?.descriptionEnriched) {
        group.system.descriptionEnriched = item.system.descriptionEnriched;
      }
    }
    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  _bindSortDragDrop(root, signal) {
    const sortableSelector = ".equipment-section--weapons .item.item--weapon, .equipment-section--outfits .item.item--outfit, .equipment-section--skills .item.item--skill";

    for (const li of root.querySelectorAll(sortableSelector)) {
      li.setAttribute("draggable", "false");
      li.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }, { signal });
      li.addEventListener("drop", (event) => this._onSortDrop(event, li), { signal });

      const handle = li.querySelector(".item-name");
      if (!handle) continue;

      handle.setAttribute("draggable", "true");
      handle.classList.add("item-sort-handle");
      handle.addEventListener("dragstart", (event) => this._onSortDragStart(event), { signal });
      handle.addEventListener("dragend", () => {
        li.classList.remove("dragging");
        this._suppressItemToggleClickFor();
      }, { signal });
    }
  }

  _onSortDragStart(event) {
    const handle = event.currentTarget;
    const li = handle.closest(".item");
    if (!li) {
      event.preventDefault();
      return;
    }
    this._suppressItemToggleClickFor();
    const itemId = li.dataset?.itemId;
    const item = itemId ? this.actor.items.get(itemId) : null;
    if (!item) {
      event.preventDefault();
      return;
    }
    li.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
    event.dataTransfer.setDragImage(li, 24, 24);
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
  async _onDropItem(event, item) {
    if (!item) return null;
    if (item.parent?.id === this.actor.id) return null;

    if (item.type === "augment" && this.actor.items.some(owned => owned.type === "augment")) {
      ui.notifications.warn(game.i18n.localize("PMTTRPG.AugmentOnlyOne"));
      return null;
    }

    return super._onDropItem(event, item);
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
