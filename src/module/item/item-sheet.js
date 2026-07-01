import { PMTTRPGUtility } from "../utility.js";
import { buildEffectSummaryGroups } from "../effects/effect-summary.js";

const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { TextEditor, FormDataExtended } = foundry.applications.ux;

function computeEffectSummary(entries = [], epMax = 0) {
  let positiveSpent = 0;
  let negativeSpent = 0;
  const signatureCounts = new Map();

  for (const entry of entries ?? []) {
    const cost = Math.abs(Number(entry?.cost ?? 0));
    const stack = Math.max(1, Number(entry?.stack ?? entry?.count ?? 1));
    const signature = [
      entry?.effectUuid ?? '',
      entry?.procOn ?? '',
      entry?.procResult ?? '',
      entry?.procStat ?? '',
      entry?.procDice ?? '',
      entry?.procAction ?? '',
      entry?.procCondition ?? '',
      entry?.mode ?? ''
    ].join('|').toLowerCase();

    signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);

    if (entry?.mode === 'negative') {
      negativeSpent += cost * stack;
    }
    else {
      positiveSpent += cost * stack;
    }
  }

  const cap = Number.isFinite(Number(epMax)) ? Number(epMax) : 0;
  const remaining = (cap + negativeSpent) - positiveSpent;
  const overPositive = positiveSpent > (cap + negativeSpent);
  const overNegative = negativeSpent > cap;
  const hasDuplicates = Array.from(signatureCounts.values()).some(count => count > 1);

  return {
    epMax: cap,
    positiveSpent,
    negativeSpent,
    remaining,
    overPositive,
    overNegative,
    hasDuplicates,
    hasWarnings: overPositive || overNegative || hasDuplicates
  };
}

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheetV2}
 */
export class PMTTRPGItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  constructor(options = {}) {
    super(options);
    this.tagify = null;
    this.needsRender = false;
    this._pendingChangeField = null;
  }

  tabGroups = { primary: 'description' };

  static DEFAULT_OPTIONS = {
    classes: ["projectmoonttrpg", "sheet", "item"],
    position: { width: 520, height: 480 },
    window: { resizable: true },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actions: {
      tab: PMTTRPGItemSheet.prototype._onTabClick,
      "sync-from-compendium": PMTTRPGItemSheet.prototype._onSyncFromCompendium,
      "dismiss-outdated": PMTTRPGItemSheet.prototype._onDismissOutdated,
      syncFromCompendium: PMTTRPGItemSheet.prototype._onSyncFromCompendium,
      dismissOutdated: PMTTRPGItemSheet.prototype._onDismissOutdated,
    },
  };

  // No template here — _renderHTML resolves the path dynamically from item type.
  // Subclasses override this with their own static PARTS.
  static PARTS = {
    body: {}
  };

  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    if (PMTTRPGUtility.nightmode && !options.classes.includes("nightmode")) {
      options.classes.push("nightmode");
    }
    return options;
  }

  // Foundry's own template preloading (during _preFirstRender) and part rendering
  // both read the part config through this hook, so resolving the per-type template
  // here — rather than patching individual render methods — guarantees the mixin
  // never sees an undefined/null template path for the base (type-less) sheet.
  _configureRenderParts(options) {
    const parts = foundry.utils.deepClone(super._configureRenderParts(options));
    if (!parts.body?.template) {
      parts.body ??= {};
      parts.body.template = `systems/projectmoonttrpg/templates/items/${this.document.type}-sheet.html`;
    }
    parts.body.scrollable ??= [".sheet-body"];
    return parts;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const itemData = this.document.toObject(false);

    const enrichmentOptions = {
      async: true,
      documents: true,
      secrets: this.document.isOwner,
      rollData: this.document.getRollData(),
      relativeTo: this.document
    };

    const system = foundry.utils.duplicate(this.document.system);

    system.descriptionEnriched = await TextEditor.enrichHTML(system.description ?? '', enrichmentOptions);

    if (itemData.type === 'effect') {
      system.positiveEnriched = await TextEditor.enrichHTML(system.positive ?? '', enrichmentOptions);
      system.negativeEnriched = await TextEditor.enrichHTML(system.negative ?? '', enrichmentOptions);
    }

    if (itemData.type === 'equipment') {
      if (system.tags != undefined && system.tags !== '') {
        let tagArray = [];
        try { tagArray = JSON.parse(system.tags); }
        catch (e) { tagArray = [system.tags]; }
        system.tagsString = tagArray.map(t => t.value).join(', ');
      }
      // Otherwise, set tags equal to the string.
      else {
        system.tags = system.tagsString;
      }
    }

    // Handle move results.
    if (itemData.type === 'move' || itemData.type === 'npcMove') {
      if (system.moveResults) {
        for (const key of Object.keys(system.moveResults)) {
          system.moveResults[key].key = `system.moveResults.${key}.value`;
          system.moveResults[key].enriched = await TextEditor.enrichHTML(system.moveResults[key].value, enrichmentOptions);
        }
      }
    }

    // Handle choices.
    if (system?.choices) {
      system.choicesEnriched = await TextEditor.enrichHTML(system.choices, enrichmentOptions);
    }

    // Handle bonds.
    if (itemData.type === 'bond') {
      const nameEnriched = await TextEditor.enrichHTML(this.document.name, enrichmentOptions);
      this.document._nameEnriched = nameEnriched;
    }

    // Handle select options.
    const selects = {};

    if (itemData.type === 'equipment') {
      selects.itemTypes = {
        weapon: 'PMTTRPG.Weapon',
        armor: 'PMTTRPG.Armor',
        dungeongear: 'PMTTRPG.DungeonGear',
        poison: 'PMTTRPG.Poison',
        service: 'PMTTRPG.Service',
        meal: 'PMTTRPG.Meal',
        transport: 'PMTTRPG.Transport',
        landbuilding: 'PMTTRPG.LandBuildings',
        bribe: 'PMTTRPG.Bribe',
        giftsfinery: 'PMTTRPG.GiftsFinery',
        hoard: 'PMTTRPG.Hoard',
      };
    }

    if (itemData.type === 'effect') {
      selects.effectAppliesTo = {
        weapon: 'TYPES.Item.weapon',
        outfit: 'TYPES.Item.outfit',
        skill: 'TYPES.Item.skill',
        augment: 'TYPES.Item.augment'
      };
    }

    if (itemData.type === 'npcMove') {
      selects.moveTypes = {
        basic: 'PMTTRPG.MoveBasic',
        special: 'PMTTRPG.MoveSpecial',
      };
    }

    if (itemData.type === 'skill') {
      selects.skillTypes = {
        attack: 'PMTTRPG.SkillTypeAttack',
        block: 'PMTTRPG.SkillTypeBlock',
        evade: 'PMTTRPG.SkillTypeEvade',
        stat: 'PMTTRPG.SkillTypeStatUse'
      };
      selects.abilities = {
        for: 'PMTTRPG.AbilityFor',
        pru: 'PMTTRPG.AbilityPru',
        jus: 'PMTTRPG.AbilityJus',
        cha: 'PMTTRPG.AbilityCha',
        ins: 'PMTTRPG.AbilityIns',
        tem: 'PMTTRPG.AbilityTem'
      };
    }

    if (itemData.type === 'move') {
      selects.moveTypes = {
        basic: 'PMTTRPG.MoveBasic',
        starting: 'PMTTRPG.MoveStarting',
        advanced: 'PMTTRPG.MoveAdvanced',
        special: 'PMTTRPG.MoveSpecial',
      };
      selects.rollTypes = {
        FOR: 'PMTTRPG.FOR',
        PRU: 'PMTTRPG.PRU',
        JUS: 'PMTTRPG.JUS',
        CHA: 'PMTTRPG.CHA',
        INS: 'PMTTRPG.INS',
        TEM: 'PMTTRPG.TEM',
        ASK: 'PMTTRPG.ASK',
        BOND: 'PMTTRPG.Modifier',
        FORMULA: 'PMTTRPG.FORMULA',
      };
    }
    if (itemData.type === 'class') {
      selects.damages = { d4: 'd4',
         d6: 'd6',
         d8: 'd8',
         d10: 'd10',
         d12: 'd12',
       };
      selects.equipmentGroupModes = {
        radio: 'PMTTRPG.ChooseOne',
        checkbox: 'PMTTRPG.ChooseAny',
      };
    }

    selects.effectModes = {
      positive: 'PMTTRPG.EffectModePositive',
      negative: 'PMTTRPG.EffectModeNegative'
    };
    selects.effectProcOn = {
      alwaysActive: 'PMTTRPG.EffectProcAlwaysActive',
      onClash: 'PMTTRPG.EffectProcOnClash',
      onClashResult: 'PMTTRPG.EffectProcOnClashResult',
      onEitherClashResult: 'PMTTRPG.EffectProcOnEitherClashResult',
      onCondition: 'PMTTRPG.EffectProcOnCondition',
      onUse: 'PMTTRPG.EffectProcOnUse',
      onBurst: 'PMTTRPG.EffectProcOnBurst',
      onCritical: 'PMTTRPG.EffectProcOnCritical',
      onDevastating: 'PMTTRPG.EffectProcOnDevastating',
      onAction: 'PMTTRPG.EffectProcOnAction'
    };
    selects.effectProcResult = {
      none: 'PMTTRPG.EffectProcResultNone',
      win: 'PMTTRPG.EffectProcResultWin',
      lose: 'PMTTRPG.EffectProcResultLose'
    };
    selects.effectProcStat = {
      any: 'PMTTRPG.EffectProcStatAny',
      for: 'PMTTRPG.AbilityFor',
      pru: 'PMTTRPG.AbilityPru',
      jus: 'PMTTRPG.AbilityJus',
      cha: 'PMTTRPG.AbilityCha',
      ins: 'PMTTRPG.AbilityIns',
      tem: 'PMTTRPG.AbilityTem'
    };
    selects.effectProcDice = {
      any: 'PMTTRPG.EffectProcDiceAny',
      offensive: 'PMTTRPG.EffectProcDiceOffensive',
      defensive: 'PMTTRPG.EffectProcDiceDefensive'
    };
    selects.effectProcAction = {
      any: 'PMTTRPG.EffectProcActionAny',
      action: 'PMTTRPG.EffectProcActionAction',
      reaction: 'PMTTRPG.EffectProcActionReaction'
    };

    Object.assign(context, {
      item: this.document,
      cssClass: this.isEditable ? "editable" : "locked",
      editable: this.isEditable,
      system,
      effects: this.document.effects.map(e => foundry.utils.deepClone(e)),
      selects,
      effectChoices: [],
      limited: this.document.limited,
      options: this.options,
      owner: this.document.isOwner,
      title: this.document.name,
      activeTab: this.tabGroups?.primary ?? "description"
    });

    if (this._supportsEffects()) {
      const effectContext = await this._prepareEffectHostContext();
      context.effectChoices = effectContext.effectChoices;
      context.system.effects = effectContext.effects;
      context.system.effectSummaryGroups = effectContext.effectSummaryGroups;
      context.system.effectSummary = effectContext.effectSummary;
      context.system.effectSearchPlaceholder = effectContext.effectSearchPlaceholder;
    }

    if (game.user.isGM && this.document.isLinkedToCompendium) {
      const { outdated, sourceModifiedTime } = await this.document.checkOutdated();
      context.isOutdated = outdated;
      context.compendiumModifiedTime = sourceModifiedTime;
    } else {
      context.isOutdated = false;
    }

    return context;
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
    for (const el of this.element.querySelectorAll(`.sheet-tabs [data-tab]`)) {
      el.classList.toggle("active", el.dataset.tab === tabId);
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (this.tagify) {
      this.tagify.destroy();
      this.tagify = null;
    }
    this._tagify(this.isEditable);

    if (!this.isEditable) return;

    this._listenerAbort?.abort();
    this._listenerAbort = new AbortController();
    const { signal } = this._listenerAbort;

    for (const el of this.element.querySelectorAll('.class-fields')) {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.class-control')) this._onClickClassControl(e);
      }, { signal });
    }

    for (const el of this.element.querySelectorAll('.status-macro-trigger')) {
      el.addEventListener('click', (e) => this._onStatusMacroTrigger(e), { signal });
    }

    if (this._supportsEffects()) {
      for (const el of this.element.querySelectorAll('.effect-control')) {
        el.addEventListener('click', (e) => this._onEffectControl(e), { signal });
      }
      for (const el of this.element.querySelectorAll('.effect-picker')) {
        el.addEventListener('change', (e) => this._onEffectPickerChange(e), { signal });
        el.addEventListener('keydown', (e) => this._onEffectPickerKeydown(e), { signal });
      }
      for (const el of this.element.querySelectorAll('.effect-row__stack')) {
        el.addEventListener('change', (e) => this._onEffectStackChange(e), { signal });
      }
      for (const el of this.element.querySelectorAll('.effect-row__proc-result-select')) {
        el.addEventListener('change', (e) => this._onEffectProcResultChange(e), { signal });
      }
      for (const el of this.element.querySelectorAll('.effect-row__proc-stat-select')) {
        el.addEventListener('change', (e) => this._onEffectProcStatChange(e), { signal });
      }
      for (const el of this.element.querySelectorAll('.effect-row__proc-action-select')) {
        el.addEventListener('change', (e) => this._onEffectProcActionChange(e), { signal });
      }
      for (const el of this.element.querySelectorAll('.effect-row__mode-select')) {
        el.addEventListener('change', (e) => this._onEffectModeChange(e), { signal });
      }

      this.element.addEventListener('dragover', this._onEffectDragOver.bind(this), { signal });
      this.element.addEventListener('drop', this._onDrop.bind(this), { signal });
    }
  }

  async _onClose(options) {
    this._listenerAbort?.abort();
    if (this.tagify) {
      this.tagify.destroy();
      if (this.needsRender && this.document?.parent) this.document.parent.render(true);
    }
    await super._onClose(options);
  }

  _onChangeForm(formConfig, event) {
    const target = event.target instanceof HTMLElement
      ? (event.target.closest("[name]") ?? event.target)
      : null;
    this._pendingChangeField = target?.name ?? null;
    return super._onChangeForm(formConfig, event);
  }

  _prepareSubmitData(event, form, formData, updateData) {
    if (this.document.type !== "class") {
      const name = this._pendingChangeField;
      this._pendingChangeField = null;
      if (name && name in formData.object) {
        const newValue = formData.object[name];
        if (newValue === foundry.utils.getProperty(this.document, name)) return {};
        return foundry.utils.expandObject({ [name]: newValue });
      }
      return {};
    }
    return super._prepareSubmitData(event, form, formData, updateData);
  }

  async _onSubmitForm(formConfig, event) {
    if (this.document.type !== "class") {
      return super._onSubmitForm(formConfig, event);
    }

    const form = this.form;
    if (!form) return;

    const formData = new FormDataExtended(form);
    const formObj = foundry.utils.expandObject(formData.object);

    let i = 0;
    const deletedKeys = [];

    if (typeof formObj.system?.equipment === 'object') {
      for (const [k, v] of Object.entries(formObj.system.equipment)) {
        if (i != k) {
          v.items = foundry.utils.duplicate(this.document.system.equipment[k]?.items ?? []);
          formObj.system.equipment[i] = v;
          delete formObj.system.equipment[k];
          deletedKeys.push(`equipment.${k}`);
        }
        i++;
      }
    }

    i = 0;
    if (typeof formObj.system?.races === 'object') {
      for (const [k, v] of Object.entries(formObj.system.races)) {
        if (i != k) {
          formObj.system.races[i] = v;
          delete formObj.system.races[k];
          deletedKeys.push(`races.${k}`);
        }
        i++;
      }
    }

    i = 0;
    if (typeof formObj.system?.alignments === 'object') {
      for (const [k, v] of Object.entries(formObj.system.alignments)) {
        if (i != k) {
          formObj.system.alignments[i] = v;
          delete formObj.system.alignments[k];
          deletedKeys.push(`alignments.${k}`);
        }
        i++;
      }
    }

    for (const k of deletedKeys) {
      const keys = k.split('.');
      if (formObj.system[keys[0]][keys[1]] == undefined) {
        formObj.system[keys[0]][`-=${keys[1]}`] = null;
      }
    }

    const flatData = Object.entries(formData.object)
      .filter(e => !e[0].match(/system\.(equipment|alignments|races)/g))
      .reduce((obj, e) => { obj[e[0]] = e[1]; return obj; }, {
        _id: this.document.id,
        "system.equipment": formObj.system?.equipment,
        "system.races": formObj.system?.races,
        "system.alignments": formObj.system?.alignments
      });

    await this.document.update(flatData);
  }

  async _onSyncFromCompendium(event, target) {
    event.preventDefault();
    await this.document.syncFromCompendium();
  }

  async _onDismissOutdated(event, target) {
    event.preventDefault();
    const modifiedTime = Number(target.dataset.modifiedTime);
    await this.document.dismissOutdatedWarning(modifiedTime);
    this.render();
  }

  async _onStatusMacroTrigger(event) {
    event.preventDefault();
    if (this.document.type !== 'status') return;
    await game.projectmoonttrpg?.statusMacros?.emitManualButton(this.document, {
      actorId: this.document.parent?.id ?? null,
      source: 'status-sheet'
    });
  }

  _supportsEffects() {
    return ['weapon', 'outfit', 'skill', 'augment'].includes(this.document.type);
  }

  _effectHostType() {
    return this.document.type;
  }

  _effectLabel(effect) {
    return PMTTRPGUtility.formatEffectProcLabel(effect);
  }

  _effectSignature(effect) {
    return [
      effect?.effectUuid ?? '',
      effect?.procOn ?? '',
      effect?.procResult ?? '',
      effect?.procStat ?? '',
      effect?.procDice ?? '',
      effect?.procAction ?? '',
      effect?.procCondition ?? '',
      effect?.mode ?? ''
    ].join('|').toLowerCase();
  }

  _getEffectStack(effect) {
    const stackRaw = Number(effect?.stack ?? effect?.count ?? 1);
    const stackMaxRaw = Number(effect?.stackMax ?? 5);
    const stackMax = Math.max(1, Number.isFinite(stackMaxRaw) ? stackMaxRaw : 5);
    return Math.max(1, Math.min(stackMax, Number.isFinite(stackRaw) ? stackRaw : 1));
  }

  _createHostEffectEntry(effectItem, { mode = null } = {}) {
    const system = effectItem?.system ?? {};
    const resolvedMode = mode ?? (Number(system.cost ?? 0) < 0 || (system.canPositive === false && system.canNegative !== false) ? 'negative' : 'positive');

    return {
      effectUuid: effectItem?.uuid ?? '',
      name: effectItem?.name ?? '',
      cost: Math.abs(Number(system.cost ?? 0) || 0),
      stack: 1,
      count: 1,
      mode: resolvedMode,
      appliesTo: system.appliesTo ?? effectItem?.type ?? this._effectHostType(),
      canPositive: system.canPositive !== false,
      canNegative: system.canNegative !== false,
      allowModeToggle: (system.canPositive !== false) && (system.canNegative !== false),
      procOn: system.procOn ?? 'alwaysActive',
      procResult: system.procResult ?? 'none',
      procResultLocked: system.procResultLocked ?? (['onClash', 'onClashResult', 'onEitherClashResult'].includes(system.procOn) && system.procResult !== 'none'),
      procStat: system.procStat ?? 'any',
      procDice: system.procDice ?? 'any',
      procAction: system.procAction ?? 'any',
      procCondition: system.procCondition ?? '',
      stackMax: Math.max(1, Number(system.stackMax ?? (system.allowMultiple === false ? 1 : 5)) || 5),
      positive: system.positive ?? '',
      negative: system.negative ?? '',
      macro: { uuid: system?.macro?.uuid ?? '' }
    };
  }

  _mergeHostEffectEntries(existingEffects = [], incomingEffect) {
    const effects = foundry.utils.duplicate(existingEffects ?? []);
    const signature = this._effectSignature(incomingEffect);
    const existingIndex = effects.findIndex(effect => this._effectSignature(effect) === signature);

    if (existingIndex >= 0) {
      const current = effects[existingIndex];
      const currentMax = Math.max(1, Number(current.stackMax ?? incomingEffect.stackMax ?? 5) || 5);
      const incomingMax = Math.max(1, Number(incomingEffect.stackMax ?? currentMax) || currentMax);
      current.stackMax = Math.min(currentMax, incomingMax);
      current.stack = Math.max(1, Math.min(current.stackMax, this._getEffectStack(current) + this._getEffectStack(incomingEffect)));
      current.count = current.stack;
      return effects;
    }

    effects.push(incomingEffect);
    return effects;
  }

  _buildEffectSummaryGroups(effects = []) {
    return buildEffectSummaryGroups(effects);
  }

  async _getEffectCatalog() {
    const hostType = this._effectHostType();
    PMTTRPGItemSheet._effectCatalogCache = PMTTRPGItemSheet._effectCatalogCache || {};
    if (PMTTRPGItemSheet._effectCatalogCache[hostType]) {
      return PMTTRPGItemSheet._effectCatalogCache[hostType];
    }

    const catalog = [];
    const packs = Array.from(game.packs ?? []).filter(pack => pack.documentName === 'Item');

    for (const effect of game.items.filter(item => item.type === 'effect')) {
      const appliesTo = effect.system?.appliesTo ?? hostType;
      if (appliesTo !== hostType) continue;
      catalog.push({
        uuid: effect.uuid,
        name: effect.name,
        label: `${effect.name} [${game.i18n.localize(`TYPES.Item.${appliesTo}`)}]`,
        appliesTo,
        canPositive: effect.system?.canPositive !== false,
        canNegative: effect.system?.canNegative !== false,
        effect: { 
          ...effect.toObject(),
          uuid: effect.uuid
        }
      });
    }

    for (const pack of packs) {
      let docs = [];
      try { 
        docs = await pack.getDocuments(); 
      }
      catch (error) { 
        continue; 
      }

      for (const effect of docs.filter(doc => doc.type === 'effect')) {
        const appliesTo = effect.system?.appliesTo ?? hostType;
        if (appliesTo !== hostType) continue;
        catalog.push({
          uuid: effect.uuid,
          name: effect.name,
          label: `${effect.name} [${game.i18n.localize(`TYPES.Item.${appliesTo}`)}]`,
          appliesTo,
          canPositive: effect.system?.canPositive !== false,
          canNegative: effect.system?.canNegative !== false,
          effect: {
            ...effect.toObject(),
            uuid: effect.uuid
          }
        });
      }
    }

    catalog.sort((left, right) => left.label.localeCompare(right.label));
    PMTTRPGItemSheet._effectCatalogCache = PMTTRPGItemSheet._effectCatalogCache || {};
    PMTTRPGItemSheet._effectCatalogCache[this._effectHostType()] = catalog;
    return catalog;
  }

  async _prepareEffectHostContext() {
    const catalog = await this._getEffectCatalog();
    const effects = foundry.utils.duplicate(this.document.system.effects ?? []).map(effect => {
      const stack = this._getEffectStack(effect);
      const showProcResult = ['onClash', 'onClashResult', 'onEitherClashResult'].includes(effect.procOn);
      const showProcStat = ['onUse', 'onAction'].includes(effect.procOn);
      const showProcAction = ['onUse', 'onAction'].includes(effect.procOn);
      return {
        ...effect,
        stack,
        count: stack,
        stackMax: Math.max(1, Number(effect.stackMax ?? 5) || 5),
        signedCost: (effect.mode === 'negative' ? -1 : 1) * Math.abs(Number(effect.cost ?? 0)),
        displayCost: (effect.mode === 'negative' ? -1 : 1) * Math.abs(Number(effect.cost ?? 0)),
        totalCost: ((effect.mode === 'negative' ? -1 : 1) * Math.abs(Number(effect.cost ?? 0))) * stack,
        allowModeToggle: effect.canPositive !== false && effect.canNegative !== false,
        showProcResult,
        showProcStat,
        showProcAction,
        procResultLocked: effect.procResultLocked ?? (['onClash', 'onClashResult', 'onEitherClashResult'].includes(effect.procOn) && effect.procResult !== 'none'),
        modeLabel: effect.mode === 'negative' ? game.i18n.localize('PMTTRPG.EffectModeNegative') : game.i18n.localize('PMTTRPG.EffectModePositive')
      };
    });

    return {
      effectChoices: catalog,
      effects,
      effectSummary: computeEffectSummary(effects, Number(this.document.system?.epMax ?? 0)),
      effectSummaryGroups: this._buildEffectSummaryGroups(effects),
      effectSearchPlaceholder: game.i18n.localize('PMTTRPG.EffectSearchPlaceholder')
    };
  }


  /**
   * Add tagging widget.
   */
  async _tagify(editable) {
    // Build the tags list.
    const inputEl = this.element?.querySelector('.tags-input-source');
    if (!inputEl) return;
    let tags = game.items.filter(item => item.type === 'tag').map(item => item.name);
    for (const c of game.packs) {
      if (c.metadata.type === 'Item' && c.metadata.name === 'tags') {
        const items = c?.index ? c.index.map(i => i.name) : [];
        tags = tags.concat(items);
      }
    }
    // Sort the tagnames list.
    const tagNames = [...new Set(tags.map(t => t.toLowerCase()))].sort();
    // Tagify!
    if (!editable) inputEl.setAttribute('readonly', 'true');
      // init Tagify script on the above inputs
    this.tagify = new Tagify(inputEl, {
      whitelist: tagNames,
      maxTags: 'Infinity',
      dropdown: {
        maxItems: 20,
        classname: "tags-look",
        enabled: 0,
        closeOnSelect: false
      }
    });
  }

  async _onClickClassControl(event) {
    event.preventDefault();
    const a = event.target.closest('.class-control');
    if (!a) return;
    const action = a.dataset.action;
    const field_type = a.dataset.type;

    const field_types = {
      races: 'race',
      alignments: 'alignment'
    };

    if (action === "create") {
      if (Object.keys(field_types).includes(field_type)) {
        const field_values = this.document.system[field_type] ?? {};
        const nk = Object.keys(field_values).length + 1;
        const update = {};
        update[`system.${field_type}.${nk}`] = { label: '', description: '' };
        await this.document.update(update);
      }
      else if (field_type === 'equipment-groups') {
        const field_values = this.document.system.equipment ?? {};
        const nk = Object.keys(field_values).length + 1;
        const systemCopy = foundry.utils.duplicate(this.document.system);
        systemCopy.equipment[nk] = { label: '', mode: 'radio', items: [], objects: [] };
        await this.document.update({ system: systemCopy });
      }
    }
    else if (action === "delete") {
      if (field_type === 'equipment-groups') {
        const elem = a.closest('.equipment-group');
        const nk = elem?.dataset?.index;
        if (!nk) return;
        const update = {};
        update[`system.equipment.-=${nk}`] = null;
        await this.document.update(update);
      }
      else {
        const li = a.closest(".item");
        const nk = li?.dataset?.index;
        if (!nk) return;
        const update = {};
        update[`system.${field_type}.-=${nk}`] = null;
        await this.document.update(update);
      }
    }
  }

  async _onEffectControl(event) {
    event.preventDefault();
    if (!this._supportsEffects()) return;

    const button = event.currentTarget;
    const action = button.dataset.action;
    const row = button.closest('.effect-row');
    const index = row ? Number(row.dataset.index ?? -1) : -1;
    const effects = foundry.utils.duplicate(this.document.system.effects ?? []);

    if (action === 'delete' && index >= 0) {
      effects.splice(index, 1);
      await this.document.update({ 'system.effects': effects });
    }
  }

  async _onEffectPickerChange(event) {
    event.preventDefault();
    event.stopPropagation();
    // Capture the input before any await: event.currentTarget is nulled out by the
    // browser once the event has finished dispatching.
    const input = event.currentTarget;
    const value = `${input?.value ?? ''}`.trim();
    if (!value) return;

    const choice = (await this._getEffectCatalog()).find(entry => entry.label === value || entry.name === value);
    if (!choice) return;

    await this._addEffectToHost(choice);
    if (input?.isConnected) input.value = '';
  }

  async _onEffectPickerKeydown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    await this._onEffectPickerChange(event);
  }

  async _onEffectStackChange(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this._supportsEffects()) return;

    const row = event.currentTarget.closest('.effect-row');
    const index = Number(row?.dataset?.index ?? -1);
    if (index < 0) return;

    const stackRaw = Number(event.currentTarget.value ?? 1);
    const stackMax = Math.max(1, Number(row?.dataset?.stackMax ?? 5) || 5);
    const stack = Math.max(1, Math.min(stackMax, Number.isFinite(stackRaw) ? stackRaw : 1));
    const effects = foundry.utils.duplicate(this.document.system.effects ?? []);
    if (!effects[index]) return;

    effects[index].stack = stack;
    effects[index].count = stack;
    await this.document.update({ 'system.effects': effects });
  }

  async _onEffectProcResultChange(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this._supportsEffects()) return;

    const row = event.currentTarget.closest('.effect-row');
    const index = Number(row?.dataset?.index ?? -1);
    if (index < 0) return;

    const effects = foundry.utils.duplicate(this.document.system.effects ?? []);
    if (!effects[index] || effects[index].procResultLocked) return;

    effects[index].procResult = `${event.currentTarget.value ?? 'none'}`;
    await this.document.update({ 'system.effects': effects });
  }

  async _onEffectProcStatChange(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this._supportsEffects()) return;

    const row = event.currentTarget.closest('.effect-row');
    const index = Number(row?.dataset?.index ?? -1);
    if (index < 0) return;

    const effects = foundry.utils.duplicate(this.document.system.effects ?? []);
    if (!effects[index]) return;

    effects[index].procStat = `${event.currentTarget.value ?? 'any'}`;
    await this.document.update({ 'system.effects': effects });
  }

  async _onEffectProcActionChange(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this._supportsEffects()) return;

    const row = event.currentTarget.closest('.effect-row');
    const index = Number(row?.dataset?.index ?? -1);
    if (index < 0) return;

    const effects = foundry.utils.duplicate(this.document.system.effects ?? []);
    if (!effects[index]) return;

    effects[index].procAction = `${event.currentTarget.value ?? 'any'}`;
    await this.document.update({ 'system.effects': effects });
  }

  async _onEffectModeChange(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this._supportsEffects()) return;

    const row = event.currentTarget.closest('.effect-row');
    const index = Number(row?.dataset?.index ?? -1);
    if (index < 0) return;

    const effects = foundry.utils.duplicate(this.document.system.effects ?? []);
    if (!effects[index]) return;

    effects[index].mode = `${event.currentTarget.value ?? 'positive'}`;
    await this.document.update({ 'system.effects': effects });
  }

  _onEffectDragOver(event) {
    if (!this._supportsEffects()) return;
    event.preventDefault();
  }

  _normalizeSubmittedEffects(submittedEffects = [], currentEffects = []) {
    const submitted = Array.isArray(submittedEffects)
      ? submittedEffects
      : (submittedEffects && typeof submittedEffects === 'object')
        ? Object.keys(submittedEffects)
          .sort((a, b) => Number(a) - Number(b))
          .map(key => submittedEffects[key])
          .filter(entry => entry != null)
        : [];

    if (!submitted.length) {
      return foundry.utils.duplicate(currentEffects ?? []);
    }

    return submitted.map((entry, index) => {
      const merged = foundry.utils.mergeObject(currentEffects[index] ?? {}, entry ?? {}, {
        inplace: false, overwrite: true
      });

      const stackMaxRaw = Number(merged?.stackMax ?? (merged?.allowMultiple === false ? 1 : 5));
      const stackMax = Math.max(1, Number.isFinite(stackMaxRaw) ? stackMaxRaw : 5);
      const stackRaw = Number(merged?.stack ?? merged?.count ?? 1);
      const stack = Math.max(1, Math.min(stackMax, Number.isFinite(stackRaw) ? stackRaw : 1));

      merged.effectUuid = merged?.effectUuid ?? merged?.uuid ?? '';
      merged.stackMax = stackMax;
      merged.stack = stack;
      merged.count = stack;

      return merged;
    });
  }

  async _addEffectToHost(effectChoice) {
    const effectData = effectChoice?.effect;
    if (!effectData || effectData.type !== 'effect') return;
    if ((effectData.system?.appliesTo ?? this._effectHostType()) !== this._effectHostType()) return;

    const incoming = this._createHostEffectEntry(effectData, {
      mode: effectData.system?.cost < 0 || effectData.system?.canPositive === false ? 'negative' : 'positive'
    });

    const effects = this._mergeHostEffectEntries(this.document.system.effects ?? [], incoming);
    await this.document.update({ 'system.effects': effects });
  }

  async _onDrop(event) {
    const rawData = event.dataTransfer?.getData('text/plain');
    if (!rawData) return false;

    let dropData = null;
    try { dropData = JSON.parse(rawData); }
    catch (err) { return false; }

    if (dropData?.type !== 'Item' || !this._supportsEffects()) return false;

    const droppedItem = await Item.fromDropData(dropData);
    if (!droppedItem || droppedItem.type !== 'effect') return false;

    if ((droppedItem.system?.appliesTo ?? this._effectHostType()) !== this._effectHostType()) return false;

    const effects = this._mergeHostEffectEntries(
      this.document.system.effects ?? [],
      this._createHostEffectEntry(droppedItem, {
        mode: droppedItem.system?.cost < 0 || droppedItem.system?.canPositive === false ? 'negative' : 'positive'
      })
    );
    await this.document.update({ 'system.effects': effects });
    return false;
  }
}
