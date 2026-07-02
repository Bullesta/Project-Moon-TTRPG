import { PMTTRPGUtility } from '../utility.js';
import { getRankFromLevel } from './progression.js';
const { renderTemplate } = foundry.applications.handlebars;

/**
 * Extends the basic Actor class for Project Moon TTRPG.
 * @extends {Actor}
 */
export class ActorPMTTRPG extends Actor {

  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareData() {
    super.prepareData();

    const actorData = this;
    const data = actorData.system;
    const flags = actorData.flags;

    if (actorData.type === 'character') this._prepareCharacterData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    const data = actorData.system;

    // Ability Scores - keep value and compute a 'mod' for use in rolls.
    for (let [a, abl] of Object.entries(data.abilities)) {
      // Ensure a numeric value exists
      abl.value = Number(abl.value) || 0;
      // For the new system the stat value itself is used as the modifier.
      abl.mod = PMTTRPGUtility.getAbilityMod(abl.value, true);

      // Add labels.
      abl.label = CONFIG.PMTTRPG.abilities[a];
    }

    // Derived Attributes based on Stats and Rank
    const rank = Number(getRankFromLevel(data.attributes.level?.value)) || 0;
    data.attributes.rank = data.attributes.rank || {};
    data.attributes.rank.value = rank;
    const fort = Number(data.abilities.for?.value) || 0;
    const pru = Number(data.abilities.pru?.value) || 0;
    const jus = Number(data.abilities.jus?.value) || 0;
    const cha = Number(data.abilities.cha?.value) || 0;
    const ins = Number(data.abilities.ins?.value) || 0;
    const tem = Number(data.abilities.tem?.value) || 0;

    // Health Points: 64 + (Fortitude*8) + (Rank*32)
    const hpMaxBase = 64 + (fort * 8) + (rank * 32);
    if (!data.attributes.hp) data.attributes.hp = {};
    data.attributes.hp.maxBase = hpMaxBase;
    data.attributes.hp.maxMisc = Number(data.attributes.hp.maxMisc) || 0;
    data.attributes.hp.max = hpMaxBase + data.attributes.hp.maxMisc;
    if (!data.attributes.hp.value) data.attributes.hp.value = data.attributes.hp.max;
    else {
      data.attributes.hp.value = Math.clamp(Number(data.attributes.hp.value) || 0, 0, data.attributes.hp.max);
    }

    // Stagger Threshold (ST): 20 + (Charm*4) + (Rank*4)
    const stMaxBase = 20 + (cha * 4) + (rank * 4);
    data.attributes.st = data.attributes.st || {};
    data.attributes.st.maxBase = stMaxBase;
    data.attributes.st.maxMisc = Number(data.attributes.st.maxMisc) || 0;
    data.attributes.st.max = stMaxBase + data.attributes.st.maxMisc;
    if (data.attributes.st.value === undefined || data.attributes.st.value === null) {
      data.attributes.st.value = data.attributes.st.max;
    } else {
      data.attributes.st.value = Math.clamp(Number(data.attributes.st.value) || 0, 0, data.attributes.st.max);
    }

    // Sanity Points (SP): 15 + (Prudence*3)
    const spMaxBase = 15 + (pru * 3);
    data.attributes.sp = data.attributes.sp || {};
    data.attributes.sp.maxBase = spMaxBase;
    data.attributes.sp.maxMisc = Number(data.attributes.sp.maxMisc) || 0;
    data.attributes.sp.max = spMaxBase + data.attributes.sp.maxMisc;
    if (data.attributes.sp.value === undefined || data.attributes.sp.value === null) {
      data.attributes.sp.value = data.attributes.sp.max;
    } else {
      data.attributes.sp.value = Math.clamp(Number(data.attributes.sp.value) || 0, 0, data.attributes.sp.max);
    }

    // Light: 3 + Rank
    const lightMaxBase = 3 + rank;
    data.attributes.light = data.attributes.light || {};
    data.attributes.light.maxBase = lightMaxBase;
    data.attributes.light.maxMisc = Number(data.attributes.light.maxMisc) || 0;
    data.attributes.light.max = lightMaxBase + data.attributes.light.maxMisc;
    if (data.attributes.light.value === undefined || data.attributes.light.value === null) {
      data.attributes.light.value = data.attributes.light.max;
    } else {
      data.attributes.light.value = Math.clamp(Number(data.attributes.light.value) || 0, 0, data.attributes.light.max);
    }

    // Equipped outfit bonuses.
    let outfitBlockBonus = 0;
    let outfitEvadeBonus = 0;
    let outfitLightBonus = 0;
    let outfitEpBonus = 0;
    for (let item of actorData.items || []) {
      if (item.type != 'outfit' || !item.system?.equipped) continue;
      outfitBlockBonus += Number(item.system?.blockDicePower ?? 0);
      outfitEvadeBonus += Number(item.system?.evadeDicePower ?? 0);
      outfitLightBonus += Number(item.system?.bonusLight ?? 0);
      outfitEpBonus += Number(item.system?.bonusEP ?? 0);
    }

    // Combat modifiers
    data.attributes.attackModifier = data.attributes.attackModifier || {};
    data.attributes.attackModifier.value = rank;
    data.attributes.evadeModifier = data.attributes.evadeModifier || {};
    data.attributes.evadeModifier.value = ins + outfitEvadeBonus;
    data.attributes.blockModifier = data.attributes.blockModifier || {};
    data.attributes.blockModifier.value = tem + outfitBlockBonus;

    data.attributes.light.maxMisc += outfitLightBonus;
    data.attributes.light.max = data.attributes.light.maxBase + data.attributes.light.maxMisc;
    data.attributes.light.value = Math.clamp(Number(data.attributes.light.value) || 0, 0, data.attributes.light.max);

    // Equipment rank limit and tool slots
    data.attributes.equipmentRankLimit = data.attributes.equipmentRankLimit || {};
    data.attributes.equipmentRankLimit.value = rank + 1;
    data.attributes.toolSlots = data.attributes.toolSlots || {};
    data.attributes.toolSlots.value = 4;

    // Speed: base dice + Justice bonus
    data.attributes.speed = data.attributes.speed || {};
    data.attributes.speed.dice = data.attributes.speed.dice || '1d6';
    data.attributes.speed.bonus = jus;

    // Add base flags.
    if (!actorData.flags.projectmoonttrpg) actorData.flags.projectmoonttrpg = {};
    if (!actorData.flags.projectmoonttrpg.sheetDisplay) actorData.flags.projectmoonttrpg.sheetDisplay = {};
    if (!actorData.flags.projectmoonttrpg.initiative) actorData.flags.projectmoonttrpg.initiative = {};
    actorData.flags.projectmoonttrpg.initiative.manualMisc = Number(actorData.flags.projectmoonttrpg.initiative.manualMisc) || 0;
    actorData.flags.projectmoonttrpg.initiative.macroMisc = Number(actorData.flags.projectmoonttrpg.initiative.macroMisc) || 0;

    // Handle max XP.
    let rollData = this.getRollData();
    if (!rollData.attributes.level.value) rollData.attributes.level.value = 0;
    let xpRequiredFormula = game.settings.get('projectmoonttrpg', 'xpFormula');
    let xpRequired = parseInt(xpRequiredFormula)
    if (isNaN(xpRequired)) {
      // Evaluate the max XP roll.
      let xpRequiredRoll = new Roll(xpRequiredFormula, this.getRollData());
      xpRequiredRoll.evaluateSync();
      xpRequired = xpRequiredRoll?.total ?? Number(data.attributes.level.value) + 7;
    }
    data.attributes.xp.max = xpRequired;

    // Handle roll mode flag.
    if (actorData?.flags?.projectmoonttrpg) {
      if (!actorData.flags.projectmoonttrpg.rollMode) actorData.flags.projectmoonttrpg.rollMode = 'def';
    }
  }

  /** @override */
  getRollData() {
    const rollData = super.getRollData();

    for (let prop of ['attributes', 'abilities']) {
      if (!rollData?.[prop]) continue;
      for (let [k, v] of Object.entries(rollData[prop])) {
        v.val = v.value;
        rollData[k] = v;
      }
    }

    if (rollData?.attributes) rollData.attr = rollData.attributes;
    if (rollData?.abilities) rollData.abil = rollData.abilities;

    return rollData;
  }

  /**
   * Listen for click events on rollables.
   * @param {MouseEvent} event
   */
  async _onRoll(event, actor = null) {
    actor = !actor ? this.actor : actor;

    // Initialize variables.
    event.preventDefault();

    if (!actor.system) {
      return;
    }

    const a = event.currentTarget;
    const data = a.dataset;
    const actorData = actor.system;
    const itemId = $(a).parents('.item').attr('data-item-id');
    const item = actor.items.get(itemId);
    let formula = null;
    let titleText = null;
    let flavorText = null;
    let templateData = {};

    // Handle rolls coming directly from the ability score.
    if ($(a).hasClass('ability-rollable') && data.mod) {
      formula = `2d6+${data.mod}`;
      flavorText = data.label;

      templateData = {
        title: flavorText
      };

      this.rollMove(formula, actor, data, templateData);
    }
    else if ($(a).hasClass('damage-rollable') && data.roll) {
      formula = data.roll;
      titleText = data.label;
      flavorText = data.flavor;
      templateData = {
        title: titleText,
        flavor: flavorText
      };

      this.rollMove(formula, actor, data, templateData, null, true);
    }
    else if (itemId != undefined) {
      item.roll();
    }
  }

  /**
   * Roll a move and use the chat card template.
   * @param {Object} templateData
   */
  async rollMove(roll, actor, dataset, templateData, form = null, applyDamage = false) {
    let actorData = actor.system;
    // Render the roll.
    let template = 'systems/projectmoonttrpg/templates/chat/chat-move.html';
    // GM rolls.
    let chatData = {
      author: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: actor })
    };
    let rollMode = game.settings.get("core", "messageMode");
    if (["gm", "blind"].includes(rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "self") chatData["whisper"] = [game.user.id];
    if (rollMode === "blind") chatData["blind"] = true;
    // Handle dice rolls.
    if (roll) {
      // Roll can be either a formula like `2d6+3` or a raw stat like `str`.
      let formula = '';
      // Handle ability scores (no input).
      if (roll.match(/(\d*)d\d+/g)) {
        formula = roll;
      }
      // Handle moves.
      else {
        formula = `2d6+${actorData.abilities[roll].mod}`;
        if (dataset.mod && dataset.mod != 0) {
          formula += `+${dataset.mod}`;
        }
      }
      if (formula != null) {
        // Do the roll.
        let roll = new Roll(`${formula}`, actor.getRollData());
        await roll.roll();
        // Add success notification.
        if (formula.includes('2d6')) {
          if (roll.total < 7) {
            templateData.result = 'failure';
          }
          else if (roll.total > 6 && roll.total < 10) {
            templateData.result = 'partial';
          }
          else {
            templateData.result = 'success';
          }
        }
        // Render it.
        roll.render().then(r => {
          templateData.rollPMTTRPG = r;
          renderTemplate(template, templateData).then(content => {
            chatData.content = content;
            if (game.dice3d) {
              game.dice3d.showForRoll(roll, game.user, true, chatData.whisper, chatData.blind).then(displayed => ChatMessage.create(chatData));
            }
            else {
              chatData.sound = CONFIG.sounds.dice;
              ChatMessage.create(chatData);
            }
          });
        });
      }
    }
    else {
      renderTemplate(template, templateData).then(content => {
        chatData.content = content;
        ChatMessage.create(chatData);
      });
    }
  }

  async applyDamage(amount, options = {op: 'full', ignoreArmor: false, piercing: 0, dmgBonus: 0}) {
    let newAmount = Number(amount);
    let dmgBonus = options?.dmgBonus;

    // Apply dmgbonus.
    if (options.op !== 'heal') {
        newAmount += parseInt(dmgBonus);
    }

    switch (options.op) {
      case 'half':
        newAmount = Math.floor(newAmount / 2);
        break;

      case 'double':
        newAmount = newAmount * 2;
        break;

      default:
        break;
    }

    let hp = this.system?.attributes?.hp?.value ?? 0;
    let hpMax = this.system?.attributes?.hp?.max ?? 1;
    let armor = this.system?.attributes?.ac?.value ?? 0;
    let piercing = options?.ignoreArmor ? armor : options?.piercing;
    let reduced = armor;

    if (!hp && !amount) return;

    // Reduce armor if needed.
    if (options.piercing && options.piercing > 0) reduced = Math.max(armor - options.piercing, 0);
    if (options.ignoreArmor) reduced = 0;
    if (isNaN(piercing)) piercing = 0;

    // Reduce damage by armor.
    if (options.op !== 'heal' && !options.ignoreArmor) {
      newAmount = Math.max(newAmount - reduced, 0);
    }

    // Adjust hp.
    let newHp = options.op === 'heal' ? hp + newAmount : hp - newAmount;
    if (newHp > hpMax) newHp = hpMax;

    if (newHp !== hp) {
      const update = {'system.attributes.hp.value': newHp};
      // Set options.PMTTRPG so that we can update scrolling text in
      // preUpdate and onUpdate.
      const context = {
        PMTTRPG: {
          armor: {
            reduced: reduced,
            value: armor,
            piercing: piercing,
          },
        },
      };
      return this.update(update, context);
    }
  }

  /**
   * Scrolling text helper method.
   *
   * @param {number} delta Difference to display.
   * @param {number} max Maximum value to calculate against.
   * @param {string} suffix Text to display
   * @param {object} overrideOptions Override options to pass to the token method.
   */
  showScrollingText(delta, max, suffix="", overrideOptions={}) {
    // Show scrolling text of hp update
    const tokens = this.isToken ? [this.token?.object] : this.getActiveTokens(true);
    if (tokens.length > 0) {
      if (!delta) delta = 0;

      let color = 0x999999;
      if (delta < 0) {
        color = 0xcc0000;
      }
      else if (delta > 0) {
        color = 0x00cc00;
      }

      for ( let token of tokens ) {
        const pct = delta !== 0 ? Math.clamp(Math.abs(delta) / max, 0, 1) : 0.25;
        let content = delta !== 0 ? delta.signedString() + " " + suffix : suffix;
        let textOptions = {
          anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
          direction: CONST.TEXT_ANCHOR_POINTS.TOP,
          fontSize: 16 + (32 * pct), // Range between [16, 48]
          fill: color,
          stroke: 0x000000,
          strokeThickness: 4,
          // jitter: 1,
          duration: 3000
        };
        canvas.interface.createScrollingText(token.center, content, foundry.utils.mergeObject(textOptions, overrideOptions));
      }
    }
  }

  /** @override */
  async _preCreate(data, options, user) {
    if (this.type === "character") {
      this.updateSource({
        prototypeToken: {
          actorLink: true,
          disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
          sight: { enabled: true }
        }
      });
    }
  }

  /** @override */
  async _preUpdate(data, options, userId) {
    await super._preUpdate(data, options, userId);
    options.PMTTRPG = options?.PMTTRPG ?? {};

    if (!options.PMTTRPG?.preUpdate) {
      options.PMTTRPG.preUpdate = {system: foundry.utils.duplicate(this.system)};
    }
  }

  /** @override */
  async _onUpdate(updateData, options, userId) {
    await super._onUpdate(updateData, options, userId);
    const context = options?.PMTTRPG?.preUpdate ?? false;

    if (!options.diff || !context || updateData.system === undefined) return; // Nothing to do.

    // Exit early if not owner.
    let displayText = this.isOwner;
    if (this.permission.default > 1) displayText = true;
    if (this.permission[game.userId] !== undefined && this.permission[game.userId] > 1) displayText = true;

    if (!displayText) return;

    // Prepare the scrolling text update.
    if (updateData.system?.attributes?.hp?.value !== undefined) {
      let hp = {
        original: context.system.attributes.hp.value ?? null,
        current: updateData.system.attributes.hp.value ?? null,
        max: context.system.attributes.hp?.max ?? updateData.system.attributes.hp.max
      }

      if (!isNaN(hp.original) && !isNaN(hp.current)) {
        hp.delta = hp.current - hp.original;

        if (hp.delta !== 0) {
          this.showScrollingText(hp.delta, hp.max, game.i18n.localize('PMTTRPG.HP'), {anchor: CONST.TEXT_ANCHOR_POINTS.TOP});
        }

        if (hp.delta < 0 && options?.PMTTRPG?.armor?.reduced) {
          let armorContext = {
            reduced: options.PMTTRPG.armor.reduced,
            piercing: options.PMTTRPG.armor?.piercing ?? 0
          };

          let textToShow = game.i18n.format('PMTTRPG.Scrolling.armorReduced', armorContext);
          if (armorContext.piercing > 0) {
            textToShow = textToShow + '\r\n' + game.i18n.format('PMTTRPG.Scrolling.armorPiercing', armorContext);
          }
          this.showScrollingText(null, null, textToShow, {anchor: CONST.TEXT_ANCHOR_POINTS.CENTER});
        }
      }
    }
  }
}
