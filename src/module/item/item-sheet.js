import { PMTTRPGUtility } from "../utility.js";

const { TextEditor } = foundry.applications.ux;
const { renderTemplate } = foundry.applications.handlebars;

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
 * @extends {ItemSheet}
 */
export class PMTTRPGItemSheet extends foundry.appv1.sheets.ItemSheet {

  /** @inheritdoc */
  constructor(...args) {
    super(...args);

    this.tagify = null;
    this.needsRender = false;
  }

  /** @override */
  static get defaultOptions() {
    let options = foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["projectmoonttrpg", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      submitOnChange: true,
    });

    if (PMTTRPGUtility.nightmode) {
      options.classes.push('nightmode');
    }

    return options;
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = "systems/projectmoonttrpg/templates/items";
    return `${path}/${this.item.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async close(options={}) {
    await super.close(options);

    if (this.tagify) {
      // Destroy the tagify instance.
      this.tagify.destroy();
      // Re-render the parent actor.
      if (this.needsRender && this.object?.parent) this.object.parent.render(true);
    }

  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    let isOwner = false;
    let isEditable = this.isEditable;
    const context = super.getData();
    const itemData = this.item.toObject(false);
    context.system = itemData.system;
    // const data = foundry.utils.deepClone(this.object.data);
    let items = {};
    let effects = {};
    let actor = null;

    context.system = foundry.utils.duplicate(this.item.system);

    this.options.title = this.document.name;
    isOwner = this.document.isOwner;
    isEditable = this.isEditable;

    // Copy Active Effects
    effects = this.object.effects.map(e => foundry.utils.deepClone(e));
    context.effects = effects;

    // Grab the parent actor, if any.
    actor = this.object?.parent;

    context.dtypes = ["String", "Number", "Boolean"];

    // Prepare enrichment options.
    const enrichmentOptions = {
      async: true,
      documents: true,
      secrets: this.item.isOwner,
      rollData: this.item.getRollData(),
      relativeTo: this.item
    };

    // Handle enriched fields.
    context.system.descriptionEnriched = await TextEditor.enrichHTML(context.system.description, enrichmentOptions);

    // Handle preprocessing for tagify data.
    if (itemData.type == 'equipment') {
      // If there are tags, convert it into a string.
      if (context.system.tags != undefined && context.system.tags != '') {
        let tagArray = [];
        try {
          tagArray = JSON.parse(context.system.tags);
        } catch (e) {
          tagArray = [context.system.tags];
        }
        context.system.tagsString = tagArray.map((item) => {
          return item.value;
        }).join(', ');
      }
      // Otherwise, set tags equal to the string.
      else {
        context.system.tags = context.system.tagsString;
      }
    }

    // Handle move results.
    if (itemData.type == 'move' || itemData.type == 'npcMove') {
      if (context.system.moveResults) {
        for (let key of Object.keys(context.system.moveResults)) {
          context.system.moveResults[key].key = `system.moveResults.${key}.value`;
          context.system.moveResults[key].enriched = await TextEditor.enrichHTML(context.system.moveResults[key].value, enrichmentOptions);
        }
      }
    }

    // Handle choices.
    if (context.system?.choices) {
      context.system.choicesEnriched = await TextEditor.enrichHTML(context.system.choices, enrichmentOptions);
    }

    // Handle bonds.
    if (itemData.type == 'bond') {
      context.item.nameEnriched = await TextEditor.enrichHTML(context.item.name, enrichmentOptions);
    }

    // Handle select options.
    context.selects = {};
    if (itemData.type == 'equipment') {
      context.selects.itemTypes = {
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

    if (itemData.type == 'effect') {
      context.selects.effectAppliesTo = {
        weapon: 'TYPES.Item.weapon',
        outfit: 'TYPES.Item.outfit',
        skill: 'TYPES.Item.skill'
      };
    }
    if (itemData.type == 'npcMove') {
      context.selects.moveTypes = {
        basic: 'PMTTRPG.MoveBasic',
        special: 'PMTTRPG.MoveSpecial',
      };
    }
    if (itemData.type == 'skill') {
      context.selects.skillTypes = {
        attack: 'PMTTRPG.SkillTypeAttack',
        block: 'PMTTRPG.SkillTypeBlock',
        evade: 'PMTTRPG.SkillTypeEvade',
        stat: 'PMTTRPG.SkillTypeStatUse'
      };
      context.selects.abilities = {
        for: 'PMTTRPG.AbilityFor',
        pru: 'PMTTRPG.AbilityPru',
        jus: 'PMTTRPG.AbilityJus',
        cha: 'PMTTRPG.AbilityCha',
        ins: 'PMTTRPG.AbilityIns',
        tem: 'PMTTRPG.AbilityTem'
      };
    }
    if (itemData.type == 'move') {
      context.selects.moveTypes = {
        basic: 'PMTTRPG.MoveBasic',
        starting: 'PMTTRPG.MoveStarting',
        advanced: 'PMTTRPG.MoveAdvanced',
        special: 'PMTTRPG.MoveSpecial',
      };

      context.selects.rollTypes = {
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
    if (itemData.type == 'class') {
      context.selects.damages = {
        d4: 'd4',
        d6: 'd6',
        d8: 'd8',
        d10: 'd10',
        d12: 'd12',
      };
      context.selects.equipmentGroupModes = {
        radio: 'PMTTRPG.ChooseOne',
        checkbox: 'PMTTRPG.ChooseAny',
      };
    }

    context.selects.effectModes = {
      positive: 'PMTTRPG.EffectModePositive',
      negative: 'PMTTRPG.EffectModeNegative'
    };
    context.selects.effectProcOn = {
      alwaysActive: 'PMTTRPG.EffectProcAlwaysActive',
      onClash: 'PMTTRPG.EffectProcOnClash',
      onCondition: 'PMTTRPG.EffectProcOnCondition',
      onUse: 'PMTTRPG.EffectProcOnUse',
      onBurst: 'PMTTRPG.EffectProcOnBurst',
      onCritical: 'PMTTRPG.EffectProcOnCritical',
      onDevastating: 'PMTTRPG.EffectProcOnDevastating',
      onAction: 'PMTTRPG.EffectProcOnAction'
    };
    context.selects.effectProcResult = {
      none: 'PMTTRPG.EffectProcResultNone',
      win: 'PMTTRPG.EffectProcResultWin',
      lose: 'PMTTRPG.EffectProcResultLose'
    };
    context.selects.effectProcStat = {
      any: 'PMTTRPG.EffectProcStatAny',
      for: 'PMTTRPG.AbilityFor',
      pru: 'PMTTRPG.AbilityPru',
      jus: 'PMTTRPG.AbilityJus',
      cha: 'PMTTRPG.AbilityCha',
      ins: 'PMTTRPG.AbilityIns',
      tem: 'PMTTRPG.AbilityTem'
    };
    context.selects.effectProcDice = {
      any: 'PMTTRPG.EffectProcDiceAny',
      offensive: 'PMTTRPG.EffectProcDiceOffensive',
      defensive: 'PMTTRPG.EffectProcDiceDefensive'
    };
    context.selects.effectProcAction = {
      any: 'PMTTRPG.EffectProcActionAny',
      action: 'PMTTRPG.EffectProcActionAction',
      reaction: 'PMTTRPG.EffectProcActionReaction'
    };

    let returnData = {
      item: this.object,
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      system: context.system,
      effects: effects,
      selects: context.selects,
      effectChoices: [],
      limited: this.object.limited,
      options: this.options,
      owner: isOwner,
      title: context.name
    };

    if (this.object.type === 'weapon' || this.object.type === 'outfit' || this.object.type === 'skill') {
      const effectContext = await this._prepareEffectHostContext();
      returnData.effectChoices = effectContext.effectChoices;
      returnData.system.effects = effectContext.effects;
      returnData.system.effectSummaryGroups = effectContext.effectSummaryGroups;
      returnData.system.effectSummary = effectContext.effectSummary;
      returnData.system.effectSearchPlaceholder = effectContext.effectSearchPlaceholder;
    }

    return returnData;
  }

  /* -------------------------------------------- */

  /** @override */
  async activateListeners(html) {
    super.activateListeners(html);

    this._tagify(html, this.isEditable);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    this.html = html;

    // Add or Remove Attribute
    html.find(".class-fields").on("click", ".class-control", this._onClickClassControl.bind(this));

    html.find('.status-macro-trigger').on('click', this._onStatusMacroTrigger.bind(this));

    if (this._supportsEffects()) {
      html.find('.effect-control').on('click', this._onEffectControl.bind(this));
      html.find('.effect-picker').on('change', this._onEffectPickerChange.bind(this));
      html.find('.effect-picker').on('keydown', this._onEffectPickerKeydown.bind(this));
      html.find('.effect-row__stack').on('change', this._onEffectStackChange.bind(this));
      html.find('.effect-row__proc-result-select').on('change', this._onEffectProcResultChange.bind(this));
      html.find('.effect-row__proc-stat-select').on('change', this._onEffectProcStatChange.bind(this));
      html.find('.effect-row__proc-action-select').on('change', this._onEffectProcActionChange.bind(this));
      html.find('.effect-row__mode-select').on('change', this._onEffectModeChange.bind(this));
      html.on('dragover', this._onEffectDragOver.bind(this));
      html.on('drop', this._onDrop.bind(this));
    }

    // TODO: Create tags that don't already exist on focus out. This is a
    // nice-to-have, but it's high risk due to how easy it will make it to
    // create extra tags unintentionally.
  }

  async _onStatusMacroTrigger(event) {
    event.preventDefault();
    if (this.object.type !== 'status') return;

    await game.projectmoonttrpg?.statusMacros?.emitManualButton(this.object, {
      actorId: this.object.parent?.id ?? null,
      source: 'status-sheet'
    });
  }

  _supportsEffects() {
    return ['weapon', 'outfit', 'skill'].includes(this.object.type);
  }

  _effectHostType() {
    return this.object.type;
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
    return Math.max(1, Math.min(5, Number.isFinite(stackRaw) ? stackRaw : 1));
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
      procStat: system.procStat ?? 'any',
      procDice: system.procDice ?? 'any',
      procAction: system.procAction ?? 'any',
      procCondition: system.procCondition ?? '',
      positive: system.positive ?? '',
      negative: system.negative ?? '',
      macro: {
        uuid: system?.macro?.uuid ?? ''
      }
    };
  }

  _mergeHostEffectEntries(existingEffects = [], incomingEffect) {
    const effects = foundry.utils.duplicate(existingEffects ?? []);
    const signature = this._effectSignature(incomingEffect);
    const existingIndex = effects.findIndex(effect => this._effectSignature(effect) === signature);

    if (existingIndex >= 0) {
      const current = effects[existingIndex];
      current.stack = this._getEffectStack(current) + this._getEffectStack(incomingEffect);
      current.count = current.stack;
      return effects;
    }

    effects.push(incomingEffect);
    return effects;
  }

  _buildEffectSummaryGroups(effects = []) {
    const blocks = [];

    for (const effect of effects ?? []) {
      const heading = foundry.utils.escapeHTML(this._effectLabel(effect) || game.i18n.localize('PMTTRPG.Effects'));
      const stack = this._getEffectStack(effect);
      const textSource = effect.mode === 'negative' ? (effect.negative || effect.positive || '') : (effect.positive || effect.negative || '');
      const text = PMTTRPGUtility.expandEffectText(textSource, stack).trim();
      const lineText = foundry.utils.escapeHTML(text || game.i18n.localize('PMTTRPG.EffectNoSummaryText'));
      blocks.push(`<div class="effect-summary-block"><strong>${heading}</strong><br><span class="effect-summary-line">- ${lineText}</span></div>`);
    }

    return [{
      key: 'combined',
      heading: game.i18n.localize('PMTTRPG.Effects'),
      summaryText: blocks.join('<br><br>')
    }];
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
    const effects = foundry.utils.duplicate(this.object.system.effects ?? []).map(effect => {
      const stack = this._getEffectStack(effect);
      const showProcResult = ['onClash', 'onClashResult', 'onEitherClashResult'].includes(effect.procOn);
      const showProcStat = ['onUse', 'onAction'].includes(effect.procOn);
      const showProcAction = ['onUse', 'onAction'].includes(effect.procOn);
      return {
        ...effect,
        stack,
        count: stack,
        signedCost: (effect.mode === 'negative' ? -1 : 1) * Math.abs(Number(effect.cost ?? 0)),
        displayCost: (effect.mode === 'negative' ? -1 : 1) * Math.abs(Number(effect.cost ?? 0)),
        totalCost: ((effect.mode === 'negative' ? -1 : 1) * Math.abs(Number(effect.cost ?? 0))) * stack,
        allowModeToggle: effect.canPositive !== false && effect.canNegative !== false,
        showProcResult,
        showProcStat,
        showProcAction,
        modeLabel: effect.mode === 'negative' ? game.i18n.localize('PMTTRPG.EffectModeNegative') : game.i18n.localize('PMTTRPG.EffectModePositive')
      };
    });

    return {
      effectChoices: catalog,
      effects,
      effectSummary: computeEffectSummary(effects, Number(this.object.system?.epMax ?? 0)),
      effectSummaryGroups: this._buildEffectSummaryGroups(effects),
      effectSearchPlaceholder: game.i18n.localize('PMTTRPG.EffectSearchPlaceholder')
    };
  }

  /**
   * Add tagging widget.
   */
  async _tagify(html, editable) {
    // Build the tags list.
    let tags = game.items.filter(item => item.type == 'tag').map(item => item.name);
    for (let c of game.packs) {
      if (c.metadata.type && c.metadata.type == 'Item' && c.metadata.name == 'tags') {
        let items = c?.index ? c.index.map(indexedItem => {
          return indexedItem.name;
        }) : [];
        tags = tags.concat(items);
      }
    }
    // Reduce duplicates.
    let tagNames = [];
    for (let tag of tags) {
      let tagName = tag.toLowerCase();
      if (tagNames.includes(tagName) === false) {
        tagNames.push(tagName);
      }
    }

    // Sort the tagnames list.
    tagNames.sort((a, b) => {
      const aSort = a.toLowerCase();
      const bSort = b.toLowerCase();
      if (aSort < bSort) {
        return -1;
      }
      if (aSort > bSort) {
        return 1;
      }
      return 0;
    });

    // Tagify!
    var $input = html.find('.tags-input-source');
    if ($input.length > 0) {
      if (!editable) {
        $input.attr('readonly', true);
      }

      // init Tagify script on the above inputs
      this.tagify = new Tagify($input[0], {
        whitelist: tagNames,
        maxTags: 'Infinity',
        dropdown: {
          maxItems: 20,           // <- mixumum allowed rendered suggestions
          classname: "tags-look", // <- custom classname for this dropdown, so it could be targeted
          enabled: 0,             // <- show suggestions on focus
          closeOnSelect: false    // <- do not hide the suggestions dropdown once an item has been selected
        }
      });

      // @todo this version of tagify updates has a strange race condition.
      // We've temporarily switched to just using the `system.tags` name prop.

      // // Update document with the changes.
      // this.tagify.on('change', e => {
      //   // Grab the raw tags.
      //   let newTags = e.detail.value;
      //   // Parse it into a string.
      //   let tagArray = [];
      //   try {
      //     tagArray = JSON.parse(newTags);
      //   } catch (e) {
      //     tagArray = [newTags];
      //   }
      //   let newTagsString = tagArray.map((item) => {
      //     return item.value;
      //   }).join(', ');

      //   // Apply the update.
      //   this.document.update({
      //     'system.tags': newTags,
      //     'system.tagsString': newTagsString
      //   }, {render: false});

      //   this.needsRender = true;
      // });
    }
  }

  /* -------------------------------------------- */

  /**
   * Listen for click events on an attribute control to modify the composition of attributes in the sheet
   * @param {MouseEvent} event    The originating left click event
   * @private
   */
  async _onClickClassControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const action = a.dataset.action;
    const field_type = a.dataset.type;
    const form = this.form;

    let field_types = {
      'races': 'race',
      'alignments': 'alignment'
    };

    // // Add new attribute
    if (action === "create") {
      if (Object.keys(field_types).includes(field_type)) {
        const field_values = this.object.system[field_type];
        const nk = Object.keys(field_values).length + 1;
        let newKey = document.createElement("div");
        newKey.innerHTML = `<li class="item ${field_types[field_type]}" data-index="${nk}">
    <div class="flexrow">
      <input type="text" class="input input--title" name="system.${field_type}.${nk}.label" value="" data-dtype="string"/>
      <a class="class-control" data-action="delete" data-type="${field_type}"><i class="fas fa-trash"></i></a>
    </div>
    <textarea class="${field_types[field_type]}" name="system.${field_type}.${nk}.description" rows="5" title="What's your ${field_types[field_type]}?" data-dtype="String"></textarea>
  </li>`;
        newKey = newKey.children[0];
        form.appendChild(newKey);
        await this._onSubmit(event);
      }
      else if (field_type == 'equipment-groups') {
        const field_values = this.object.system.equipment;
        const nk = Object.keys(field_values).length + 1;
        let template = '/systems/projectmoonttrpg/templates/items/_class-sheet--equipment-group.html';
        let templateData = {
          group: nk
        };
        let newKey = document.createElement('div');
        newKey.innerHTML = await renderTemplate(template, templateData);
        newKey = newKey.children[0];

        let update = {
          system: foundry.utils.duplicate(this.object.system)
        };
        update.system.equipment[nk] = {
          label: '',
          mode: 'radio',
          items: [],
          objects: []
        };

        await this.object.update(update);

        form.appendChild(newKey);
        await this._onSubmit(event);
      }
    }

    // Remove existing attribute
    else if (action === "delete") {
      const field_type = a.dataset.type;
      if (field_type == 'equipment-groups') {
        let elem = a.closest('.equipment-group');
        const nk = elem.dataset.index;
        elem.parentElement.removeChild(elem);
        let update = {};
        update[`system.equipment.-=${nk}`] = null;
        await this.object.update(update);
        await this._onSubmit(event);
      }
      else {
        const li = a.closest(".item");
        const nk = li.dataset.index;
        li.parentElement.removeChild(li);
        let update = {};
        update[`system.${field_type}.-=${nk}`] = null;
        await this.object.update(update);
        await this._onSubmit(event);
      }
    }
  }

  /* -------------------------------------------- */

  async _onEffectControl(event) {
    event.preventDefault();
    if (!this._supportsEffects()) return;

    const button = event.currentTarget;
    const action = button.dataset.action;
    const row = button.closest('.effect-row');
    const index = row ? Number(row.dataset.index ?? -1) : -1;
    const effects = foundry.utils.duplicate(this.object.system.effects ?? []);

    if (action === 'delete' && index >= 0) {
      effects.splice(index, 1);
    }
    else {
      return;
    }

    await this.object.update({ 'system.effects': effects });
  }

  async _onEffectPickerChange(event) {
    event.preventDefault();
    event.stopPropagation();
    const value = `${event.currentTarget?.value ?? ''}`.trim();
    if (!value) return;

    const choice = (await this._getEffectCatalog()).find(entry => entry.label === value || entry.name === value);
    if (!choice) return;

    await this._addEffectToHost(choice);
    event.currentTarget.value = '';
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
    const stack = Math.max(1, Math.min(5, Number.isFinite(stackRaw) ? stackRaw : 1));
    const effects = foundry.utils.duplicate(this.object.system.effects ?? []);
    if (!effects[index]) return;

    effects[index].stack = stack;
    effects[index].count = stack;
    await this.object.update({ 'system.effects': effects });
  }

  async _onEffectProcResultChange(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this._supportsEffects()) return;

    const row = event.currentTarget.closest('.effect-row');
    const index = Number(row?.dataset?.index ?? -1);
    if (index < 0) return;

    const effects = foundry.utils.duplicate(this.object.system.effects ?? []);
    if (!effects[index]) return;

    effects[index].procResult = `${event.currentTarget.value ?? 'none'}`;
    await this.object.update({ 'system.effects': effects });
  }

  async _onEffectProcStatChange(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this._supportsEffects()) return;

    const row = event.currentTarget.closest('.effect-row');
    const index = Number(row?.dataset?.index ?? -1);
    if (index < 0) return;

    const effects = foundry.utils.duplicate(this.object.system.effects ?? []);
    if (!effects[index]) return;

    effects[index].procStat = `${event.currentTarget.value ?? 'any'}`;
    await this.object.update({ 'system.effects': effects });
  }

  async _onEffectProcActionChange(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this._supportsEffects()) return;

    const row = event.currentTarget.closest('.effect-row');
    const index = Number(row?.dataset?.index ?? -1);
    if (index < 0) return;

    const effects = foundry.utils.duplicate(this.object.system.effects ?? []);
    if (!effects[index]) return;

    effects[index].procAction = `${event.currentTarget.value ?? 'any'}`;
    await this.object.update({ 'system.effects': effects });
  }

  async _onEffectModeChange(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this._supportsEffects()) return;

    const row = event.currentTarget.closest('.effect-row');
    const index = Number(row?.dataset?.index ?? -1);
    if (index < 0) return;

    const effects = foundry.utils.duplicate(this.object.system.effects ?? []);
    if (!effects[index]) return;

    effects[index].mode = `${event.currentTarget.value ?? 'positive'}`;
    await this.object.update({ 'system.effects': effects });
  }

  _onEffectDragOver(event) {
    if (!this._supportsEffects()) return;
    event.preventDefault();
  }

  async _addEffectToHost(effectChoice) {
    const effectData = effectChoice?.effect;
    if (!effectData || effectData.type !== 'effect') return;
    if ((effectData.system?.appliesTo ?? this._effectHostType()) !== this._effectHostType()) return;

    const incoming = this._createHostEffectEntry(effectData, {
      mode: effectData.system?.cost < 0 || effectData.system?.canPositive === false ? 'negative' : 'positive'
    });

    const effects = this._mergeHostEffectEntries(this.object.system.effects ?? [], incoming);
    await this.object.update({ 'system.effects': effects });
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDrop(event) {
    const rawData = event.originalEvent?.dataTransfer?.getData('text/plain')
      ?? event.dataTransfer?.getData('text/plain');

    if (!rawData) {
      return super._onDrop ? super._onDrop(event) : false;
    }

    let dropData = null;
    try {
      dropData = JSON.parse(rawData);
    }
    catch (err) {
      return super._onDrop ? super._onDrop(event) : false;
    }

    if (dropData?.type !== 'Item' || !this._supportsEffects()) {
      return super._onDrop ? super._onDrop(event) : false;
    }

    const droppedItem = await Item.fromDropData(dropData);
    if (!droppedItem || droppedItem.type !== 'effect') {
      return super._onDrop ? super._onDrop(event) : false;
    }

    if ((droppedItem.system?.appliesTo ?? this._effectHostType()) !== this._effectHostType()) {
      return false;
    }

    const effects = this._mergeHostEffectEntries(this.object.system.effects ?? [], this._createHostEffectEntry(droppedItem, {
      mode: droppedItem.system?.cost < 0 || droppedItem.system?.canPositive === false ? 'negative' : 'positive'
    }));
    await this.object.update({ 'system.effects': effects });

    return false;
  }

  /* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {

    // Exit early for other item types.
    if (this.object.type != 'class') {
      return this.object.update(formData);
    }

    // Handle the freeform lists on classes.
    const formObj = foundry.utils.expandObject(formData);

    // Re-index the equipment.
    let i = 0;
    let deletedKeys = [];
    if (typeof formObj.system.equipment == 'object') {
      for (let [k, v] of Object.entries(formObj.system.equipment)) {
        if (i != k) {
          v.items = foundry.utils.duplicate(this.object.system.equipment[k]?.items ?? []);
          formObj.system.equipment[i] = v;
          delete formObj.system.equipment[k];
          deletedKeys.push(`equipment.${k}`);
        }
        i++;
      }
    }

    // Re-index the races.
    i = 0;
    if (typeof formObj.system.races == 'object') {
      for (let [k, v] of Object.entries(formObj.system.races)) {
        if (i != k) {
          formObj.system.races[i] = v;
          delete formObj.system.races[k];
          deletedKeys.push(`races.${k}`);
        }
        i++;
      }
    }

    // Re-index the alignments.
    i = 0;
    if (typeof formObj.system.alignments == 'object') {
      for (let [k, v] of Object.entries(formObj.system.alignments)) {
        if (i != k) {
          formObj.system.alignments[i] = v;
          delete formObj.system.alignments[k];
          deletedKeys.push(`alignments.${k}`);
        }
        i++;
      }
    }

    // Remove deleted keys.
    for (let k of deletedKeys) {
      const keys = k.split('.');
      if (formObj.system[keys[0]][keys[1]] == undefined) {
        formObj.system[keys[0]][`-=${keys[1]}`] = null;
      }
    }

    // Re-combine formData
    formData = Object.entries(formData).filter(e => !e[0].match(/system\.(equipment|alignments|races)/g)).reduce((obj, e) => {
      obj[e[0]] = e[1];
      return obj;
    }, {
      _id: this.object.id,
      "system.equipment": formObj.system.equipment,
      "system.races": formObj.system.races,
      "system.alignments": formObj.system.alignments
    });


    // Update the Item
    return this.object.update(formData);
  }
}
