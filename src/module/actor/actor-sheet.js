
import { PMTTRPGUtility } from "../utility.js";
import { PMTTRPGRolls } from "../rolls.js";
import { PMTTRPGTargetingAPI } from "../targeting.js";
import { buildEffectSummaryGroups } from "../effects/effect-summary.js";

const { TextEditor } = foundry.applications.ux;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class PMTTRPGActorSheet extends foundry.appv1.sheets.ActorSheet {

  /** @inheritdoc */
  constructor(...args) {
    super(...args);

    this.tagify = null;
  }

  /** @override */
  static get defaultOptions() {
    let options = foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["projectmoonttrpg", "sheet", "actor"],
      width: 1280,
      height: 780,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "weapons-attacks" }]
    });

    if (PMTTRPGUtility.nightmode) {
      options.classes.push('nightmode');
    }

    return options;
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = "systems/projectmoonttrpg/templates/sheet";
    return `${path}/${this.actor.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async close(options={}) {
    await super.close(options);

    if (this.tagify) this.tagify.destroy();
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    let isOwner = false;
    let isEditable = this.isEditable;
    let context = super.getData(options);
    let items = {};
    let effects = {};
    let actorData = {};

    isOwner = this.document.isOwner;
    isEditable = this.isEditable;

    // The Actor's data
    actorData = this.actor.toObject(false);
    context.actor = actorData;
    context.system = actorData.system;

    // Owned Items
    context.items = actorData.items;
    for ( let i of context.items ) {
      const item = this.actor.items.get(i._id);
      i.labels = item.labels;
    }
    context.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));

    // Flags
    context.rollModes = {
      def: 'PMTTRPG.Normal',
      adv: 'PMTTRPG.Advantage',
      dis: 'PMTTRPG.Disadvantage'
    };

    // Copy Active Effects
    // TODO: Test and refactor this.
    effects = this.object.effects.map(e => foundry.utils.deepClone(e));
    context.effects = effects;

    context.dtypes = ["String", "Number", "Boolean"];
    for (let attr of Object.values(context.system.attributes)) {
      attr.isCheckbox = attr.dtype === "Boolean";
    }

    // Prepare enrichment options.
    context.enrichmentOptions = {
      async: true,
      documents: true,
      secrets: this.actor.isOwner,
      rollData: this.actor.getRollData(),
      relativeTo: this.actor
    };

    // Prepare items.
    await this._prepareCharacterItems(context);
    await this._prepareNpcItems(context);
    context.allWeapons = context.items.filter(item => item.type === 'weapon').sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.augments = context.items.filter(item => item.type === 'augment').map((augment) => {
      const augmentDocument = this.actor.items.get(augment._id);
      if (augmentDocument) {
        augment.system = foundry.utils.mergeObject(
          foundry.utils.duplicate(augment.system ?? {}),
          foundry.utils.duplicate(augmentDocument.system ?? {}),
          { inplace: false }
        );
      }

      // Ensure effect summary groups are present for actor-sheet rendering.
      try {
        augment.system = augment.system || {};
        augment.system.effectSummaryGroups = buildEffectSummaryGroups(augment.system?.effects ?? []);
      }
      catch (err) {
        // Fail silently - effect summary is optional for display.
      }

      return augment;
    }).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.augment = context.augments[0] ?? null;
    context.statuses = this._prepareStatusItems(context.items);
    this._logInventoryState('getData', context.items, context.statuses);
    this._logActorSheetEvent('getData-ready', {
      itemCount: context.items.length,
      weaponCount: context.allWeapons.length,
      skillCount: context.skills?.length ?? 0,
      outfitCount: context.outfits?.length ?? 0,
      augmentCount: context.augments?.length ?? 0
    });

    // Enrich the bio field.
    context.system.details.biographyEnriched = await TextEditor.enrichHTML(context.system.details.biography, context.enrichmentOptions);

    if (this.actor.type == 'character') {

      // Handle enriched fields.
      context.system.details.lookEnriched = await TextEditor.enrichHTML(context.system.details.look, context.enrichmentOptions);

      // Set a warning for tokens.
      context.system.isToken = this.actor.token != null;
      if (!context.system.isToken) {
        // Add levelup choice.
        let level = context.system.attributes.level.value ?? 1;
        let xpRequired = context.system.attributes.xp.max ?? Number(level) + 7;
        context.xpRequired = xpRequired;
        let levelup = Number(context.system.attributes.xp.value) >= xpRequired && Number(level) < 10;

        // Handle the first level (special case).
        if (Number(level) === 1) {
          let hasStarting = context.startingMoves.length > 0;
          if (!hasStarting) {
            levelup = true;
          }
        }

        // Set the template variable.
        context.system.levelup = levelup;

        // Calculate xp bar length.
        let currentXp = Number(context.system.attributes.xp.value);
        let nextLevel = Number(context.system.attributes.xp.max);
      }
      else {
        context.system.levelup = false;
      }
    }

    // Stats.
    context.system.statSettings = {
      'for': 'PMTTRPG.FOR',
      'pru': 'PMTTRPG.PRU',
      'jus': 'PMTTRPG.JUS',
      'cha': 'PMTTRPG.CHA',
      'ins': 'PMTTRPG.INS',
      'tem': 'PMTTRPG.TEM'
    };

    // Setup select options.
    context.selects = {};
    context.selects.weaponTypes = {
      melee: 'PMTTRPG.WeaponTypeMelee',
      ranged: 'PMTTRPG.WeaponTypeRanged'
    };
    context.selects.outfitProperties = {
      none: 'PMTTRPG.OutfitPropertyNone',
      armored: 'PMTTRPG.OutfitPropertyArmored',
      swift: 'PMTTRPG.OutfitPropertySwift',
      balanced: 'PMTTRPG.OutfitPropertyBalanced'
    };
    context.selects.damageTypes = {
      slash: 'PMTTRPG.DamageTypeSlash',
      pierce: 'PMTTRPG.DamageTypePierce',
      blunt: 'PMTTRPG.DamageTypeBlunt'
    };
    context.selects.formPropertiesMelee = {
      small: 'PMTTRPG.FormPropertySmall',
      medium: 'PMTTRPG.FormPropertyMedium',
      long: 'PMTTRPG.FormPropertyLong',
      sturdy: 'PMTTRPG.FormPropertySturdy',
      hybrid: 'PMTTRPG.FormPropertyHybridMelee',
      versatile: 'PMTTRPG.FormPropertyVersatile',
      innate: 'PMTTRPG.FormPropertyInnateMelee'
    };
    context.selects.formPropertiesRanged = {
      lowCaliber: 'PMTTRPG.FormPropertyLowCaliber',
      highCaliber: 'PMTTRPG.FormPropertyHighCaliber',
      reactive: 'PMTTRPG.FormPropertyReactive',
      hybrid: 'PMTTRPG.FormPropertyHybridRanged',
      recoil: 'PMTTRPG.FormPropertyRecoil',
      innate: 'PMTTRPG.FormPropertyInnateRanged'
    };
    context.selects.handPropertiesMelee = {
      off1h: 'PMTTRPG.HandPropertyOff1H',
      off2h: 'PMTTRPG.HandPropertyOff2H',
      def1h: 'PMTTRPG.HandPropertyDef1H',
      def2h: 'PMTTRPG.HandPropertyDef2H'
    };
    context.selects.handPropertiesRanged = {
      off1h: 'PMTTRPG.HandPropertyOff1H',
      off2h: 'PMTTRPG.HandPropertyOff2H'
    };
    context.selects.ammoTypes = {
      standard: 'PMTTRPG.AmmoStandard',
      specialized: 'PMTTRPG.AmmoSpecialized'
    };
    context.selects.skillTypes = {
      attack: 'PMTTRPG.SkillTypeAttack',
      block: 'PMTTRPG.SkillTypeBlock',
      evade: 'PMTTRPG.SkillTypeEvade',
      stat: 'PMTTRPG.SkillTypeStatUse'
    };
    // Ability/stat choices for stat-use skills
    context.selects.abilities = {
      for: 'PMTTRPG.AbilityFor',
      pru: 'PMTTRPG.AbilityPru',
      jus: 'PMTTRPG.AbilityJus',
      cha: 'PMTTRPG.AbilityCha',
      ins: 'PMTTRPG.AbilityIns',
      tem: 'PMTTRPG.AbilityTem'
    };

    // Return data to the sheet
    let returnData = {
      actor: this.object,
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      system: context.system,
      moves: context.moves,
      rollModes: context.rollModes,
      basicMoves: context.basicMoves,
      advancedMoves: context.advancedMoves,
      startingMoves: context.startingMoves,
      specialMoves: context.specialMoves,
      equipment: context.equipment,
      weapons: context.weapons,
      allWeapons: context.allWeapons,
      outfits: context.outfits,
      augment: context.augment,
      augments: context.augments,
      ammunition: context.ammunition,
      skills: context.skills,
      ammoSlotsUsed: context.ammoSlotsUsed,
      spells: context.spells,
      statuses: context.statuses,
      effects: effects,
      items: items,
      flags: this.object?.flags,
      selects: context.selects,
      limited: this.object.limited,
      options: this.options,
      owner: isOwner,
      title: this.title,
      xpRequired: context.xpRequired,
      rollData: this.actor.getRollData()
    };

    // Return template data
    return returnData;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  async _prepareCharacterItems(sheetData) {
    // Exit early if this isn't a character.
    if (sheetData.actor.type !== 'character') return;

    const actorData = sheetData.actor;
    const enrichmentOptions = {
      async: true,
      documents: true,
      secrets: this.actor.isOwner,
      rollData: this.actor.getRollData(),
    };

    // Initialize containers.
    const moves = [];
    const basicMoves = [];
    const startingMoves = [];
    const advancedMoves = [];
    const specialMoves = [];
    const equipment = [];
    const weapons = {
      melee: [],
      ranged: []
    };
    const outfits = [];
    const ammunition = [];
    const skills = [];
    let specializedAmmoCount = 0;
    const spells = {
      0: [],
      1: [],
      3: [],
      5: [],
      7: [],
      9: []
    };

    // Iterate through items, allocating to containers
    // let totalWeight = 0;
    for (let i of sheetData.items) {
      const item = this.actor.items.get(i._id);
      enrichmentOptions.relativeTo = item;
      enrichmentOptions.rollData = item.getRollData();
      if (i.system?.description) {
        i.system.descriptionEnriched = await TextEditor.enrichHTML(i.system.description, enrichmentOptions);
      }

      i.img = i.img || foundry.documents.BaseActor.DEFAULT_ICON;
      // If this is a move, sort into various arrays.
      if (i.type === 'move') {
        i.system.choicesEnriched = await TextEditor.enrichHTML(i.system.choices, enrichmentOptions);
        for (let [k, v] of Object.entries(i.system.moveResults)) {
          i.system.moveResults[k].enriched = await TextEditor.enrichHTML(v.value, enrichmentOptions);
        }

        switch (i.system.moveType) {
        case 'basic':
          basicMoves.push(i);
          break;

        case 'starting':
          startingMoves.push(i);
          break;

        case 'advanced':
          advancedMoves.push(i);
          break;

        case 'special':
          specialMoves.push(i);
          break;

        default:
          moves.push(i);
          break;
        }
      }
      else if (i.type === 'spell') {
        if (i.system.spellLevel != undefined) {
          spells[i.system.spellLevel].push(i);
        }
      }
      else if (i.type === 'weapon') {
        if (i.system.weaponType === 'ranged') {
          weapons.ranged.push(i);
        }
        else {
          weapons.melee.push(i);
        }
      }
      else if (i.type === 'outfit') {
        outfits.push(i);
      }
      else if (i.type === 'ammunition') {
        ammunition.push(i);
        if (i.system.ammoType === 'specialized') {
          specializedAmmoCount += Number(i.system.quantity ?? 0);
        }
      }
      else if (i.type === 'skill') {
        skills.push(i);
      }
      // If this is equipment, we currently lump it together.
      else if (i.type === 'equipment') {
        equipment.push(i);
      }
    }

    // Assign and return
    sheetData.moves = moves;
    sheetData.basicMoves = basicMoves;
    sheetData.startingMoves = startingMoves;
    sheetData.advancedMoves = advancedMoves;
    sheetData.specialMoves = specialMoves;
    // Spells
    sheetData.spells = spells;
    // Equipment
    sheetData.equipment = equipment;
    sheetData.weapons = weapons;
    sheetData.outfits = outfits;
    sheetData.ammunition = ammunition;
    sheetData.skills = skills;
    sheetData.ammoSlotsUsed = specializedAmmoCount > 0 ? Math.ceil(specializedAmmoCount / 5) : 0;

    // Compute grouped effect summaries for weapons and outfits so the actor sheet
    // can render a compact auto-generated summary (same style as item sheets).
    const buildGroupsFor = (item) => {
      try {
        item.system = item.system || {};
        item.system.effectSummaryGroups = buildEffectSummaryGroups(item.system?.effects ?? []);
      }
      catch (err) {
        // ignore
      }
    };

    // Attach groups for melee and ranged weapons
    for (const w of sheetData.weapons.melee ?? []) buildGroupsFor(w);
    for (const w of sheetData.weapons.ranged ?? []) buildGroupsFor(w);
    // Attach groups for outfits
    for (const o of sheetData.outfits ?? []) buildGroupsFor(o);

    // Compute equipped weapon/outfit baseline info to expose for skill rendering
    const equippedWeapon = this.actor.items.find(i => i.type === 'weapon' && i.system?.equipped) || this.actor.items.find(i => i.type === 'weapon');
    const equippedOutfit = this.actor.items.find(i => i.type === 'outfit' && i.system?.equipped) || this.actor.items.find(i => i.type === 'outfit');

    for (let s of sheetData.skills) {
      s.equippedWeaponDamageType = equippedWeapon?.system?.damageType || null;
      s.equippedWeaponOffensiveDiceComputed = equippedWeapon?.system?.offensiveDiceComputed || null;
      s.equippedOutfitBlockDiceComputed = equippedOutfit?.system?.blockDiceComputed || null;
      s.equippedOutfitEvadeDiceComputed = equippedOutfit?.system?.evadeDiceComputed || null;
      // Ensure a stat key exists for stat-use skills
      s.system.stat = s.system.stat || 'for';
    }
  }

  /**
   * Prepare tagging.
   *
   * @param {Object} actorData The actor to prepare.
   */
  async _prepareNpcItems(sheetData) {
    // Exit early if this isn't an npc.
    if (sheetData.actor.type != 'npc') return;

    // If there are tags, convert it into a string.
    if (sheetData.system.tags != undefined && sheetData.system.tags != '') {
      let tagArray = [];
      try {
        tagArray = JSON.parse(sheetData.system.tags);
      } catch (e) {
        tagArray = [sheetData.system.tags];
      }
      sheetData.system.tagsString = tagArray.map((item) => {
        return item.value;
      }).join(', ');
    }
    // Otherwise, set tags equal to the string.
    else {
      sheetData.system.tags = sheetData.system.tagsString;
    }

    const actorData = sheetData.actor;
    const enrichmentOptions = {
      async: true,
      documents: true,
      secrets: this.actor.isOwner,
      rollData: this.actor.getRollData(),
    };

    // Initialize containers.
    const moves = [];
    const basicMoves = [];
    const specialMoves = [];

    // Iterate through items, allocating to containers
    // let totalWeight = 0;
    for (let i of sheetData.items) {
      const item = this.actor.items.get(i._id);
      enrichmentOptions.relativeTo = item;
      enrichmentOptions.rollData = item.getRollData();
      if (i.system?.description) {
        i.system.descriptionEnriched = await TextEditor.enrichHTML(i.system.description, enrichmentOptions);
      }

      i.img = i.img || foundry.documents.BaseActor.DEFAULT_ICON;
      // If this is a move, sort into various arrays.
      if (i.type === 'npcMove') {
        switch (i.system.moveType) {
        case 'basic':
          basicMoves.push(i);
          break;

        case 'special':
          specialMoves.push(i);
          break;

        default:
          moves.push(i);
          break;
        }
      }
    }

    // Assign and return
    sheetData.moves = moves;
    sheetData.basicMoves = basicMoves;
    sheetData.specialMoves = specialMoves;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    if (this.actor.type == 'npc') {
      this._activateTagging(html);
    }

    if (!this.options.editable) return;

    // Rollables.
    html.find('.rollable').on('click', this._onRollable.bind(this));
    html.find('.initiative-roll').on('click', this._onInitiativeRoll.bind(this));

    // Toggle look.
    html.find('.toggle--look').on('click', this._toggleLook.bind(this, html));

    // Owned Item management
    html.find('.item-create').click(this._onItemCreate.bind(this));
    html.find('.item-edit').click(this._onItemEdit.bind(this));
    html.find('.item-delete').click(this._onItemDelete.bind(this));
    html.find('.item-equip').click(this._onEquipEquipment.bind(this));

    // Moves
    html.find('.item-label').click(this._showItemDetails.bind(this));

    // Adjust quantity/uses.
    html.find('.counter').on('click', event => this._onCounterClick(event, 'increase'));
    html.find('.counter').on('contextmenu', event => this._onCounterClick(event, 'decrease'));
    html.find('.counter--increase').on('click', event => this._onCounterClick(event, 'increase'));
    html.find('.counter--decrease').on('click', event => this._onCounterClick(event, 'decrease'));

    // Status stacks.
    html.find('.status-control').on('click', this._onStatusControl.bind(this));

    // Resources.
    html.find('.resource-control').click(this._onResouceControl.bind(this));

    html.on('dragover', event => event.preventDefault());
    html.on('drop', this._onDrop.bind(this));

    let isOwner = this.document.isOwner;
    if (isOwner) {
      /* Item Dragging */
      var handler;
      handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        li.setAttribute("draggable", false);
        li.addEventListener("dragstart", handler, false);
      });
      html.find(".item-sort").on("mousedown", event => {
        event.stopPropagation();

        const itemElement = event.currentTarget.closest("li.item");
        itemElement?.setAttribute("draggable", true);
      });

      html.find(".item-sort").on("mouseup", event => {
        const itemElement = event.currentTarget.closest("li.item");
        itemElement?.setAttribute("draggable", false);
      });
      html.find(".item--weapon").on("drop", this._onWeaponSortDrop.bind(this));
      html.find(".item--outfit").on("drop", this._onOutfitSortDrop.bind(this));
    }
    
    html.find(".item-toggle-details").on(
      "click", event => {event.preventDefault();
      const itemElement = event.currentTarget.closest(".item");
      itemElement.classList.toggle("collapsed");
    });
  }

  /* -------------------------------------------- */

  // _adjustWeight removed as weight is not part of the new definition.

  _onResouceControl(event) {
    event.preventDefault();
    const control = $(event.currentTarget);
    const action = control.data('action');
    const attr = control.data('attr');
    // If there's an action and target attribute, update it.
    if (action && attr) {
      // Initialize data structure.
      let system = {};
      let changed = false;
      // Retrieve the existin value.
      system[attr] = Number(foundry.utils.getProperty(this.actor.system, attr));
      // Decrease the value.
      if (action == 'decrease') {
        system[attr] -= 1;
        changed = true;
      }
      // Increase the value.
      else if (action == 'increase') {
        system[attr] += 1;
        changed = true;
      }
      // If there are changes, apply to the actor.
      if (changed) {
        this.actor.update({ system: system });
      }
    }
  }

  _showItemDetails(event) {
    event.preventDefault();
    const toggler = $(event.currentTarget);
    const toggleIcon = toggler.find('i');
    const item = toggler.parents('.item');
    const description = item.find('.item-description');

    toggler.toggleClass('open');
    description.slideToggle();
  }

  async _onLevelUp(event) {
    // TODO: this is the function that should trigger on level up start
  }

  /**
   * Import moves.
   */
  async _onLevelUpSave(dlg, actor, itemData) {
    // TODO: this is the function that should trigger on level up end
  }

  /**
   * Listen for click events on equipment.
   * @param {MouseEvent} event
   */
  async _onEquipEquipment(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const data = a.dataset;
    const actorData = this.actor.system;
    const itemId = $(a).parents('.item').attr('data-item-id');
    const item = this.actor.items.get(itemId);

    if (item) {
      let $self = $(a);
      $self.toggleClass('unequipped');

      let update =
      { "system.equipped": !item.system.equipped };
      this._logActorSheetEvent('item-equip-toggle', {
        itemId: item.id,
        itemName: item.name,
        itemType: item.type,
        previous: !!item.system.equipped,
        next: !item.system.equipped
      });
      await item.update(update, {});

      this.render();
    }
  }

  /**
   * Listen for click events on quantity/uses.
   * @param {MouseEvent} event
   */
  async _onCounterClick(event, changeType = 'increase') {
    event.preventDefault();
    const a = event.currentTarget;
    const dataset = a.dataset;
    const actorData = this.actor.system;
    const itemId = $(a).parents('.item').attr('data-item-id');
    const item = this.actor.items.get(itemId);

    if (!dataset.action || !item) return;

    let offset = changeType == 'increase' ? 1 : -1;
    let update = {};

    switch (dataset.action) {
    case 'uses':
      let uses = item.system?.uses ?? 0;
      update['system.uses'] = Math.max(0, Number(uses) + offset);
      break;

    case 'quantity':
      let quantity = item.system?.quantity ?? 0;
      update['system.quantity'] = Math.max(0, Number(quantity) + offset);
      break;

    default:
        break;
    }

    await item.update(update, {});
    this._logActorSheetEvent('item-counter-update', {
      itemId: item.id,
      itemName: item.name,
      itemType: item.type,
      changeType,
      action: dataset.action,
      appliedUpdate: update
    });

    this.render();
  }

  /**
   * Listen for click events on rollables.
   * @param {MouseEvent} event
   */
  async _onRollable(event) {
    // Initialize variables.
    event.preventDefault();
    const a = event.currentTarget;
    const data = a.dataset;
    const actorData = this.actor.system;
    const itemId = $(a).parents('.item').attr('data-item-id');
    const item = this.actor.items.get(itemId);
    let formula = null;
    let titleText = null;
    let flavorText = null;
    let templateData = {};

    let dice = PMTTRPGUtility.getRollFormula('2d6');

    // Handle rolls coming directly from the ability score.
    if ($(a).hasClass('ability-rollable') && data.roll) {
      flavorText = data.label;
      templateData = {
        title: flavorText
      };

      return PMTTRPGRolls.doStatRoll({
        actor: this.actor,
        stat: data.roll,
        label: flavorText,
        templateData
      });
    }
    else if ($(a).hasClass('damage-rollable') && data.roll) {
      formula = data.roll;
      titleText = data.label;
      flavorText = data.flavor;
      templateData = {
        title: titleText,
        flavor: flavorText,
        rollType: 'damage'
      };

      PMTTRPGRolls.rollMove({actor: this.actor, data: null, formula: formula, templateData: templateData});
    }
    else if (item?.type === 'outfit' && data.roll) {
      await item.roll({ mode: data.rollType || 'block' });
    }
    else if (item?.type === 'weapon' && data.ammoId) {
      const ammo = this.actor.items.get(data.ammoId);
      await item.roll({ ammo });
    }
    else if (itemId != undefined) {
      await item.roll();
    }
  }

  async _onInitiativeRoll(event) {
    event.preventDefault();
    const form = event.currentTarget.closest('form');
    const macroMisc = Number(form?.querySelector('input[name="flags.projectmoonttrpg.initiative.macroMisc"]')?.value ?? 0) || 0;
    const manualMisc = Number(form?.querySelector('input[name="flags.projectmoonttrpg.initiative.manualMisc"]')?.value ?? 0) || 0;
    await PMTTRPGTargetingAPI.rollInitiative(this.actor, { macroMisc, manualMisc });
  }

  /**
   * Listen for toggling the look column.
   * @param {MouseEvent} event
   */
  async _toggleLook(html, event) {
    // Add a class to the sidebar.
    html.find('.sheet-look').toggleClass('closed');

    // Add a class to the toggle button.
    let $look = html.find('.toggle--look');
    $look.toggleClass('closed');

    // Update flags.
    let closed = $look.hasClass('closed');
    await this.actor.update({'flags.projectmoonttrpg.sheetDisplay.sidebarClosed': closed});
  }

  /* -------------------------------------------- */
  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;

    if (type === 'augment' && this.actor.items.some(item => item.type === 'augment')) {
      ui.notifications.warn(game.i18n.localize('PMTTRPG.AugmentOnlyOne'));
      return;
    }

    const data = foundry.utils.duplicate(header.dataset);
    data.moveType = data.movetype;
    data.spellLevel = data.level;
    const itemName = data.name || game.i18n.localize(`TYPES.Item.${type}`) || type;
    const itemData = {
      name: itemName,
      type: type,
      system: data
    };
    delete itemData.system["type"];
    this._logActorSheetEvent('item-create', {
      itemType: type,
      itemName,
      seedSystem: itemData.system
    });
    await this.actor.createEmbeddedDocuments('Item', [itemData], {});
  }

  /**
   * Handle dropping a status item onto the actor sheet.
   * @param {DragEvent} event The originating drop event.
   * @private
   */
  async _onWeaponSortDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const rawData = event.originalEvent?.dataTransfer?.getData('text/plain');
    if (!rawData) return false;

    let dropData = null;

    try {
      dropData = JSON.parse(rawData);
    } catch (err) {
      return false;
    }

    if (dropData?.type !== 'Item') return false;

    const draggedItem = await Item.fromDropData(dropData);

    const targetElement = event.currentTarget;
    const targetItemId = targetElement?.dataset?.itemId;
    const targetItem = this.actor.items.get(targetItemId);

    if (!draggedItem || !targetItem) return false;
    if (draggedItem.parent?.id !== this.actor.id) return false;
    if (draggedItem.type !== 'weapon') return false;
    if (targetItem.type !== 'weapon') return false;
    if (draggedItem.id === targetItem.id) return false;

    const weapons = this.actor.items
      .filter(item => item.type === 'weapon')
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));

    const draggedIndex = weapons.findIndex(item => item.id === draggedItem.id);
    const targetIndex = weapons.findIndex(item => item.id === targetItem.id);

    if (draggedIndex === -1 || targetIndex === -1) return false;

    weapons.splice(draggedIndex, 1);
    weapons.splice(targetIndex, 0, draggedItem);

    const updates = weapons.map((item, index) => ({
      _id: item.id,
      sort: index * 100000
    }));

    await this.actor.updateEmbeddedDocuments('Item', updates);

    return false;
  }

  async _onOutfitSortDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const rawData = event.originalEvent?.dataTransfer?.getData('text/plain');
    if (!rawData) return false;

    let dropData = null;

    try {
      dropData = JSON.parse(rawData);
    } catch (err) {
      return false;
    }

    if (dropData?.type !== 'Item') return false;

    const draggedItem = await Item.fromDropData(dropData);

    const targetElement = event.currentTarget;
    const targetItemId = targetElement?.dataset?.itemId;
    const targetItem = this.actor.items.get(targetItemId);

    if (!draggedItem || !targetItem) return false;
    if (draggedItem.parent?.id !== this.actor.id) return false;
    if (draggedItem.type !== 'outfit') return false;
    if (targetItem.type !== 'outfit') return false;
    if (draggedItem.id === targetItem.id) return false;

    const outfits = this.actor.items
      .filter(item => item.type === 'outfit')
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));

    const draggedIndex = outfits.findIndex(item => item.id === draggedItem.id);
    const targetIndex = outfits.findIndex(item => item.id === targetItem.id);

    if (draggedIndex === -1 || targetIndex === -1) return false;

    outfits.splice(draggedIndex, 1);
    outfits.splice(targetIndex, 0, draggedItem);

    const updates = outfits.map((item, index) => ({
      _id: item.id,
      sort: index * 100000
    }));

    await this.actor.updateEmbeddedDocuments('Item', updates);

    return false;
  }

  async _onDrop(event) {
    const rawData = event.originalEvent?.dataTransfer?.getData('text/plain');
    if (!rawData) return false;

    let dropData = null;
    try {
      dropData = JSON.parse(rawData);
    } catch (err) {
      return false;
    }

    if (dropData?.type !== 'Item') return false;

    const droppedItem = await Item.fromDropData(dropData);
    if (!droppedItem || (droppedItem.type !== 'status' && droppedItem.type !== 'augment')) return false;
    if (droppedItem.parent?.id === this.actor.id) return false;
    if (droppedItem.type === 'augment' && this.actor.items.some(item => item.type === 'augment')) {
      ui.notifications.warn(game.i18n.localize('PMTTRPG.AugmentOnlyOne'));
      return false;
    }

    event.preventDefault();

    const itemData = foundry.utils.duplicate(droppedItem.toObject());
    delete itemData._id;
    delete itemData.id;
    delete itemData.uuid;
    itemData.system = foundry.utils.duplicate(itemData.system ?? {});

    this._logActorSheetEvent('item-drop-import', {
      droppedType: droppedItem.type,
      droppedName: droppedItem.name,
      droppedUuid: droppedItem.uuid,
      sourceActorId: droppedItem.parent?.id ?? null,
      targetActorId: this.actor.id
    });

    await this.actor.createEmbeddedDocuments('Item', [itemData], {});
    this._logInventoryState(`drop-${droppedItem.type}`, this.actor.items, this._prepareStatusItems(this.actor.items));
    return false;
  }

  /**
   * Adjust or remove a status stack count.
   * @param {Event} event The originating click event.
   * @private
   */
  async _onStatusControl(event) {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    const li = button.closest('.item');
    const action = button.dataset.action;
    const statusKey = li?.dataset?.statusKey;
    const statusItems = this.actor.items.filter(item => item.type === 'status' && this._statusKey(item) === statusKey);
    const item = statusItems[0];

    if (!item) return;

    if (action === 'increase') {
      const itemData = foundry.utils.duplicate(item.toObject());
      delete itemData._id;
      delete itemData.id;
      delete itemData.uuid;
      await this.actor.createEmbeddedDocuments('Item', [itemData], {});
    }
    else if (action === 'decrease') {
      if (statusItems.length <= 1) {
        await item.delete();
      }
      else {
        await statusItems[statusItems.length - 1].delete();
      }
    }
    else if (action === 'remove') {
      await this.actor.deleteEmbeddedDocuments('Item', statusItems.map(statusItem => statusItem.id));
    }

    this._logInventoryState(`status-${action}`, this.actor.items, this._prepareStatusItems(this.actor.items));
  }

  /**
   * Return a normalized key for comparing status copies.
   * @param {Item} item The item to inspect.
   * @returns {string}
   * @private
   */
  _statusKey(item) {
    return `${item?.name ?? ''}`.trim().toLowerCase();
  }

  /**
   * Group owned status copies so the sheet can show one row per status with a count.
   * @param {Array} items The items to group.
   * @returns {Array}
   * @private
   */
  _prepareStatusItems(items = []) {
    const grouped = new Map();

    for (const item of items) {
      if (item.type !== 'status') continue;

      const key = this._statusKey(item) || item.id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          name: item.name,
          img: item.img,
          count: 0,
          items: [],
          representative: item,
          system: foundry.utils.duplicate(item.system),
        });
      }

      const group = grouped.get(key);
      group.count += 1;
      group.items.push(item);
      group.representative = group.representative ?? item;
      group.img = group.img || item.img;
      group.system.descriptionEnriched = group.system.descriptionEnriched || item.system?.descriptionEnriched || '';
    }

    return Array.from(grouped.values()).sort((left, right) => left.name.localeCompare(right.name));
  }

  /**
   * Log the actor inventory and grouped statuses for debugging.
   * @param {string} label Debug label for the current snapshot.
   * @param {Array} items Items to log.
   * @param {Array} statuses Grouped statuses to log.
   * @private
   */
  _logInventoryState(label, items = [], statuses = []) {
    const inventory = items.map(item => ({
      id: item.id,
      type: item.type,
      name: item.name,
      img: item.img,
      stacks: item.system?.stacks ?? null,
      effectsCount: Array.isArray(item.system?.effects) ? item.system.effects.length : 0,
      effectUuids: Array.isArray(item.system?.effects)
        ? item.system.effects.map(effect => effect?.effectUuid ?? effect?.uuid ?? '').filter(Boolean)
        : []
    }));
    const statusSummary = statuses.map(status => ({
      key: status.key,
      name: status.name,
      count: status.count,
      ids: status.items.map(item => item.id),
    }));

    console.log(`[PMTTRPG][Inventory][${label}]`, inventory);
    console.log(`[PMTTRPG][Statuses][${label}]`, statusSummary);
  }

  /**
   * Structured log helper for actor sheet lifecycle and interactions.
   * @param {string} label Event label.
   * @param {Object} details Additional debug context.
   * @private
   */
  _logActorSheetEvent(label, details = {}) {
    const actorName = this.actor?.name ?? this.object?.name ?? 'UnknownActor';
    const actorId = this.actor?.id ?? this.object?.id ?? 'unknown';
    console.log(`[PMTTRPG][ActorSheet][${actorName}][${actorId}][${label}]`, details);
  }

  /* -------------------------------------------- */

  /**
   * Handle editing an existing Owned Item for the Actor
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemEdit(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId ?? event.currentTarget.closest(".item")?.dataset?.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    this._logActorSheetEvent('item-edit-open', {
      itemId: item.id,
      itemName: item.name,
      itemType: item.type
    });
    item.sheet.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting an existing Owned Item for the Actor
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemDelete(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId ?? event.currentTarget.closest(".item")?.dataset?.itemId;
    if (!itemId) return;
    let item = this.actor.items.get(itemId);
    if (!item) return;
    this._logActorSheetEvent('item-delete-before', {
      itemId: item.id,
      itemName: item.name,
      itemType: item.type
    });
    await item.delete();
    this._logActorSheetEvent('item-delete-after', {
      deletedItemId: itemId
    });
  }

  /* -------------------------------------------- */

  async _activateTagging(html) {
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
    if (!this.isEditable) $input.prop('readonly', true);
    if ($input.length > 0) {
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
      // });
    }
  }
}
