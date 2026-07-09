import { PMTTRPGUtility } from "../utility.js";
import { PMTTRPGRolls } from "../rolls.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { TextEditor } = foundry.applications.ux;

export class PMTTRPGActorNpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  constructor(options = {}) {
    super(options);
    this.tagify = null;
  }

  static DEFAULT_OPTIONS = {
    classes: ["projectmoonttrpg", "sheet", "actor", "npc"],
    position: { width: 560, height: 640 },
    window: { resizable: true },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    body: { template: "systems/projectmoonttrpg/templates/sheet/npc-sheet.html", scrollable: [".sheet-wrapper"] }
  };

  tabGroups = {
    primary: "moves"
  };

  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    if (PMTTRPGUtility.nightmode && !options.classes.includes("nightmode")) {
      options.classes.push("nightmode");
    }
    return options;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isEditable = this.isEditable;

    const actorData = this.actor.toObject(false);
    context.actor = this.actor;
    context.system = actorData.system;

    context.enrichmentOptions = {
      async: true,
      documents: true,
      secrets: this.actor.isOwner,
      rollData: this.actor.getRollData(),
      relativeTo: this.actor,
    };

    context.system.details = context.system.details ?? {};
    context.system.details.biographyEnriched = await TextEditor.enrichHTML(
      context.system.details.biography ?? '',
      context.enrichmentOptions
    );

    await this._prepareNpcItems(context, actorData);

    context.cssClass = isEditable ? "editable" : "locked";
    context.editable = isEditable;
    context.owner = this.actor.isOwner;
    context.limited = this.actor.limited;
    context.rollData = this.actor.getRollData();

    context.system.statSettings = {
      for: 'PMTTRPG.FOR', pru: 'PMTTRPG.PRU', jus: 'PMTTRPG.JUS',
      cha: 'PMTTRPG.CHA', ins: 'PMTTRPG.INS', tem: 'PMTTRPG.TEM'
    };

    return context;
  }

  async _prepareNpcItems(sheetData, actorData) {
    const items = (actorData.items ?? []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));

    const enrichmentOptions = {
      async: true,
      documents: true,
      secrets: this.actor.isOwner,
      rollData: this.actor.getRollData(),
    };

    if (sheetData.system.tags != undefined && sheetData.system.tags !== '') {
      let tagArray = [];
      try { tagArray = JSON.parse(sheetData.system.tags); }
      catch (e) { tagArray = [sheetData.system.tags]; }
      sheetData.system.tagsString = tagArray.map(t => t.value).join(', ');
    }
    else {
      sheetData.system.tags = sheetData.system.tagsString;
    }

    const moves = [];
    const basicMoves = [];
    const specialMoves = [];

    for (const i of items) {
      const item = this.actor.items.get(i._id);
      if (!item) continue;
      enrichmentOptions.relativeTo = item;
      enrichmentOptions.rollData = item.getRollData();

      if (i.system?.description) {
        i.system.descriptionEnriched = await TextEditor.enrichHTML(i.system.description, enrichmentOptions);
      }
      i.img = i.img || foundry.documents.BaseActor.DEFAULT_ICON;

      if (i.type === 'npcMove') {
        if (i.system.moveResults) {
          for (const key of Object.keys(i.system.moveResults)) {
            i.system.moveResults[key].enriched = await TextEditor.enrichHTML(
              i.system.moveResults[key].value ?? '', enrichmentOptions
            );
          }
        }
        switch (i.system.moveType) {
          case 'basic':   basicMoves.push(i); break;
          case 'special': specialMoves.push(i); break;
          default:        moves.push(i); break;
        }
      }
    }

    sheetData.moves = moves;
    sheetData.basicMoves = basicMoves;
    sheetData.specialMoves = specialMoves;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (this.tagify) {
      this.tagify.destroy();
      this.tagify = null;
    }
    this._activateTagging();

    const group = 'primary';
    const activeTab = this.tabGroups?.[group] ?? 'moves';
    for (const el of this.element.querySelectorAll(`[data-group="${group}"][data-tab]`)) {
      el.classList.toggle('active', el.dataset.tab === activeTab);
    }

    if (!this.isEditable) return;

    this._listenerAbort?.abort();
    this._listenerAbort = new AbortController();
    const { signal } = this._listenerAbort;

    for (const el of this.element.querySelectorAll('.sheet-tabs a[data-tab]')) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = el.dataset.tab;
        const grp = this.element.querySelector('.sheet-tabs')?.dataset?.group ?? 'primary';
        this.tabGroups[grp] = tabName;
        for (const tabEl of this.element.querySelectorAll(`[data-group="${grp}"][data-tab]`)) {
          tabEl.classList.toggle('active', tabEl.dataset.tab === tabName);
        }
      }, { signal });
    }

    for (const el of this.element.querySelectorAll('.rollable')) {
      el.addEventListener('click', (e) => this._onRollable(e, el), { signal });
    }

    for (const el of this.element.querySelectorAll('.item-create')) {
      el.addEventListener('click', (e) => this._onItemCreate(e, el), { signal });
    }
    for (const el of this.element.querySelectorAll('.item-edit')) {
      el.addEventListener('click', (e) => this._onItemEdit(e, el), { signal });
    }
    for (const el of this.element.querySelectorAll('.item-delete')) {
      el.addEventListener('click', (e) => this._onItemDelete(e, el), { signal });
    }
  }

  async _onClose(options) {
    this._listenerAbort?.abort();
    if (this.tagify) this.tagify.destroy();
    await super._onClose(options);
  }

  async _activateTagging() {
    const inputEl = this.element?.querySelector('.tags-input-source');
    if (!inputEl) return;

    let tags = game.items.filter(item => item.type === 'tag').map(item => item.name);
    for (const c of game.packs) {
      if (c.metadata.type === 'Item' && c.metadata.name === 'tags') {
        const items = c?.index ? c.index.map(i => i.name) : [];
        tags = tags.concat(items);
      }
    }

    const tagNames = [...new Set(tags.map(t => t.toLowerCase()))].sort();

    if (!this.isEditable) inputEl.setAttribute('readonly', 'true');

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

  async _onRollable(event, target) {
    event.preventDefault();
    const data = target.dataset;
    const itemId = target.dataset.itemId ?? target.closest('.item')?.dataset?.itemId;
    const item = itemId ? this.actor.items.get(itemId) : null;

    if (target.classList.contains('ability-rollable') && data.roll) {
      const flavorText = data.label;
      return PMTTRPGRolls.doStatRoll({
        actor: this.actor, stat: data.roll, label: flavorText, templateData: { title: flavorText }
      });
    }
    else if (target.classList.contains('damage-rollable') && data.roll) {
      return PMTTRPGRolls.rollMove({
        actor: this.actor, data: null, formula: data.roll,
        templateData: { title: data.label, flavor: data.flavor, rollType: 'damage' }
      });
    }
    else if (item) {
      return item.roll();
    }
  }

  async _onItemCreate(event, target) {
    event.preventDefault();
    const type = target.dataset.type;
    const data = foundry.utils.duplicate(target.dataset);
    data.moveType = data.movetype ?? data.moveType;
    const itemName = data.name || game.i18n.localize(`TYPES.Item.${type}`) || type;
    delete data.action;
    delete data.type;
    delete data.name;
    delete data.movetype;
    const itemData = { name: itemName, type, system: data };
    await this.actor.createEmbeddedDocuments('Item', [itemData], {});
  }

  _onItemEdit(event, target) {
    event.preventDefault();
    const itemId = target.dataset.itemId ?? target.closest('.item')?.dataset?.itemId;
    if (!itemId) return;
    this.actor.items.get(itemId)?.sheet.render(true);
  }

  async _onItemDelete(event, target) {
    event.preventDefault();
    const itemId = target.dataset.itemId ?? target.closest('.item')?.dataset?.itemId;
    if (!itemId) return;
    await this.actor.items.get(itemId)?.delete();
  }

  /** @override */
  async _onDropItem(event, item) {
    if (!item) return null;
    if (item.parent?.id === this.actor.id) return null;

    if (item.type === 'augment' && this.actor.items.some(owned => owned.type === 'augment')) {
      ui.notifications.warn(game.i18n.localize('PMTTRPG.AugmentOnlyOne'));
      return null;
    }

    return super._onDropItem(event, item);
  }
}
