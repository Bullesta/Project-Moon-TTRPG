import { PMTTRPGUtility } from '../utility.js';
import { getActionEconomyFromRank, getRankFromLevel } from './progression.js';
const { renderTemplate } = foundry.applications.handlebars;
import { applyAlwaysActiveModifiers, runOnTakingDamage } from '../easy-effects/registry.js';
import { applyResourceModsToSystem, applyResourceOverridesToSystem } from '../easy-effects/nouns.js';
import { applyInventorySlotUsage } from '../inventory/slots.js';
import {
  APPLY_POOLS,
  DAMAGE_TYPES,
  buildAppliedDamage,
  normalizePools,
  poolTempPath,
  poolValuePath,
  postDamageTakenMessage,
  resolveResistance,
  tempPoolKey,
} from '../damage-application.js';

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

    if (actorData.type === 'character' || actorData.type === 'npc') {
      this._prepareCharacterData(actorData);
      for (const item of this.items) {
        if (item.type === 'weapon' || item.type === 'outfit') item.prepareData();
      }
    }
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    const data = actorData.system;

    if (!data.abilities) {
      if (actorData.type !== 'npc') return;
      data.abilities = {
        for: { value: 0, min: -1, mod: 0, debility: false },
        pru: { value: 0, min: -1, mod: 0, debility: false },
        jus: { value: 0, min: -1, mod: 0, debility: false },
        cha: { value: 0, min: -1, mod: 0, debility: false },
        ins: { value: 0, min: -1, mod: 0, debility: false },
        tem: { value: 0, min: -1, mod: 0, debility: false },
      };
    }
    if (!data.attributes.light) {
      data.attributes.light = { value: 0, min: 0, maxBase: 0, maxMisc: 0, max: 0 };
    }
    for (const key of ['actions', 'reactions', 'movement']) {
      if (!data.attributes[key]) {
        data.attributes[key] = { value: 0, min: 0, maxBase: 0, maxMisc: 0, max: 0 };
      }
    }
    if (!data.details) data.details = {};
    if (!data.details.gmBrief) {
      data.details.gmBrief = {
        complexityGm: 0,
        complexityPlayers: 0,
        strength: '',
        designIntention: '',
        recommendedBehavior: '',
        lore: '',
        notes: '',
      };
    }

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
    if (data.attributes.hp.value === undefined || data.attributes.hp.value === null) {
      data.attributes.hp.value = data.attributes.hp.max;
    } else {
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

    // Light: 3 + Rank. Clamp after equipment bonuses.
    const lightMaxBase = 3 + rank;
    data.attributes.light = data.attributes.light || {};
    data.attributes.light.maxBase = lightMaxBase;
    data.attributes.light.maxMisc = Number(data.attributes.light.maxMisc) || 0;
    data.attributes.light.max = lightMaxBase + data.attributes.light.maxMisc;
    if (data.attributes.light.value === undefined || data.attributes.light.value === null) {
      data.attributes.light.value = data.attributes.light.max;
    } else {
      data.attributes.light.value = Number(data.attributes.light.value) || 0;
    }

    const economy = getActionEconomyFromRank(rank);
    for (const [key, maxBase] of [
      ['actions', economy.actions],
      ['reactions', economy.reactions],
      ['movement', economy.movement],
    ]) {
      const pool = data.attributes[key] || {};
      data.attributes[key] = pool;
      pool.min = 0;
      pool.maxBase = maxBase;
      pool.maxMisc = Number(pool.maxMisc) || 0;
      pool.max = pool.maxBase + pool.maxMisc;
      if (pool.value === undefined || pool.value === null) {
        pool.value = pool.max;
      } else {
        pool.value = Number(pool.value) || 0;
      }
    }

    // Equipped outfit bonuses. NPCs always use their loadout outfits.
    let outfitBlockBonus = 0;
    let outfitEvadeBonus = 0;
    let outfitLightBonus = 0;
    let outfitEpBonus = 0;
    const isNpc = actorData.type === 'npc';
    for (let item of actorData.items || []) {
      if (item.type != 'outfit') continue;
      if (!isNpc && !item.system?.equipped) continue;
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

    // Equipment rank limit and inventory slot pools
    data.attributes.equipmentRankLimit = data.attributes.equipmentRankLimit || {};
    data.attributes.equipmentRankLimit.value = rank + 1;
    data.attributes.toolSlots = data.attributes.toolSlots || {};
    data.attributes.toolSlots.value = 4;
    data.attributes.narrativeSlots = data.attributes.narrativeSlots || {};
    data.attributes.narrativeSlots.value = 4;
    data.attributes.stockSlots = data.attributes.stockSlots || {};
    data.attributes.stockSlots.value = 4;

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

    try {
      const eeMods = applyAlwaysActiveModifiers(actorData);
      data.attributes.attackModifier.value += eeMods.attackPower;
      data.attributes.evadeModifier.value += eeMods.evadePower;
      data.attributes.blockModifier.value += eeMods.blockPower;
      applyResourceModsToSystem(data, eeMods);
      for (const key of ['hp', 'st', 'sp']) {
        const pool = data.attributes[key];
        if (!pool) continue;
        pool.eeMaxOverridden = false;
        pool.eeMaxOverrideBy = "";
        pool.max = (Number(pool.maxBase) || 0) + (Number(pool.maxMisc) || 0);
        pool.value = Math.clamp(Number(pool.value) || 0, 0, pool.max);
      }
      if (data.attributes.light) {
        data.attributes.light.eeMaxOverridden = false;
        data.attributes.light.eeMaxOverrideBy = "";
      }
      applyResourceOverridesToSystem(data, eeMods);
      data.attributes.light.value = Math.clamp(
        Number(data.attributes.light.value) || 0, 0, data.attributes.light.max
      );
      // damagePower / damageMax / attackMax / blockMax / evadeMax are
      // clash-time bonuses, but we store them for weapon/dice resolution later.
      data.attributes.easyEffectsMods = eeMods;
    } catch (err) {
      console.error('[EasyEffects] Error in Always Active pass:', err);
    }

    for (const key of ['actions', 'reactions', 'movement']) {
      const pool = data.attributes[key];
      if (!pool) continue;
      pool.max = (Number(pool.maxBase) || 0) + (Number(pool.maxMisc) || 0);
      const raw = Number(pool.value) || 0;
      pool.value = key === 'reactions'
        ? Math.max(0, raw)
        : Math.clamp(raw, 0, pool.max);
    }

    applyInventorySlotUsage(data.attributes, actorData.items);
    for (const key of ['toolSlots', 'narrativeSlots', 'stockSlots']) {
      const pool = data.attributes[key];
      pool.over = Number(pool.used ?? 0) > Number(pool.value ?? 0);
    }
  }

  async refreshActionEconomy() {
    const updates = {};
    for (const key of ['actions', 'reactions', 'movement']) {
      const pool = this.system.attributes?.[key];
      if (!pool) continue;
      const max = Number(pool.max) || 0;
      if ((Number(pool.value) || 0) !== max) {
        updates[`system.attributes.${key}.value`] = max;
      }
    }
    if (foundry.utils.isEmpty(updates)) return this;
    return this.update(updates);
  }

  /**
   * Spend from an action-economy pool.
   * @param {"actions"|"reactions"|"movement"} poolKey
   * @param {number} [amount=1]
   */
  async spendActionEconomy(poolKey, amount = 1) {
    const allowed = new Set(['actions', 'reactions', 'movement']);
    if (!allowed.has(poolKey)) {
      throw new Error(`Invalid action economy pool: ${poolKey}`);
    }
    const pool = this.system.attributes?.[poolKey];
    if (!pool) return this;
    const spent = Math.max(0, Number(amount) || 0);
    if (spent === 0) return this;
    const current = Number(pool.value) || 0;
    if (current < spent) {
      ui.notifications.warn(game.i18n.format('PMTTRPG.Notifications.actionEconomyInsufficient', {
        name: this.name,
        pool: game.i18n.localize({
          actions: 'PMTTRPG.Actions',
          reactions: 'PMTTRPG.Reactions',
          movement: 'PMTTRPG.Movement',
        }[poolKey]),
        current,
        needed: spent,
      }));
    }
    const next = Math.max(0, current - spent);
    if (next === current) return this;
    return this.update({ [`system.attributes.${poolKey}.value`]: next });
  }

  /**
   * Convert Actions into Reactions
   * @param {number} [amount] Defaults to all remaining Actions.
   */
  async convertActionsToReactions(amount) {
    const actionPool = this.system.attributes?.actions;
    const reactionPool = this.system.attributes?.reactions;
    if (!actionPool || !reactionPool) return this;

    const available = Math.max(0, Number(actionPool.value) || 0);
    if (available <= 0) {
      ui.notifications.warn(game.i18n.format("PMTTRPG.Notifications.convertNoActions", {
        name: this.name,
      }));
      return this;
    }

    let n = (amount === undefined || amount === null)
      ? available
      : Math.max(0, Math.floor(Number(amount) || 0));

    if (n <= 0) {
      ui.notifications.warn(game.i18n.format("PMTTRPG.Notifications.convertNoActions", {
        name: this.name,
      }));
      return this;
    }

    if (n > available) {
      ui.notifications.warn(game.i18n.format("PMTTRPG.Notifications.convertActionsCapped", {
        name: this.name,
        available,
      }));
      n = available;
    }

    return this.update({
      "system.attributes.actions.value": available - n,
      "system.attributes.reactions.value": (Number(reactionPool.value) || 0) + n,
    });
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


    let rollMode = "publicroll";
    switch(game.release.generation) {
      case 13:
        rollMode = game.settings.get("core", "rollMode");
        break;
      // assume latest version
      default:
        rollMode = game.settings.get("core", "messageMode");
        break;
    }
    
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

  /**
   * Apply damage or healing to one or more pools.
   * @param {number|string} amount
   * @param {object} [options]
   * @param {"full"|"half"|"double"|"heal"} [options.op="full"]
   * @param {"hp"|"st"|"sp"|Array<"hp"|"st"|"sp">} [options.pool="hp"]
   * @param {string} [options.sourceLabel]
   * @returns {Promise<object|null>}
   */
  async applyDamage(amount, options = {}) {
    const op = options.op ?? "full";
    const pools = normalizePools(options.pool);
    const createMessage = options.createMessage !== false;
    const rawDamageType = typeof options.damageType === "string" ? options.damageType.trim() : "";
    const damageType = DAMAGE_TYPES.includes(rawDamageType.toLowerCase()) ? rawDamageType.toLowerCase() : null;
    const eeDamageType = damageType || rawDamageType;
    const source = typeof options.source === "string" && options.source.trim() ? options.source.trim() : null;
    const explicitSourceLabel = typeof options.sourceLabel === "string" && options.sourceLabel.trim()
      ? options.sourceLabel.trim()
      : null;
    const sourceLabel = explicitSourceLabel ?? source ?? options.attacker?.name ?? null;
    const afterResistance = Number(options.afterResistance) || 0;
    const forceSkipResistance = options.skipResistance === true || op === "heal";
    const useOutfitTypeResists = !source && !forceSkipResistance;
    const skipEasyEffects = options.skipEasyEffects === true;

    const base = Number(amount) || 0;
    let sharedAmount = base;
    switch (op) {
      case "half":
        sharedAmount = Math.floor(sharedAmount / 2);
        break;
      case "double":
        sharedAmount *= 2;
        break;
      default:
        break;
    }

    const breakdown = [];
    if (sourceLabel) breakdown.push({ key: "source", source: sourceLabel });
    breakdown.push({ key: "base", amount: base });
    if (op !== "full") breakdown.push({ key: "op", op, from: base, to: sharedAmount });

    let amountAfterSource = sharedAmount;
    let poolsAfter = pools;
    let damageTypeForResist = damageType;

    if (op !== "heal" && !skipEasyEffects) {
      const beforeEe = amountAfterSource;
      const damageCtx = {
        amount: amountAfterSource,
        pool: pools.length === 1 ? (pools[0] ?? "hp") : pools.slice(),
        source: source ?? "",
        damageType: eeDamageType,
      };
      await runOnTakingDamage(this, damageCtx, { attacker: options.attacker ?? null });
      amountAfterSource = Math.max(0, Number(damageCtx.amount) || 0);
      poolsAfter = normalizePools(damageCtx.pool);

      const rawAfter = typeof damageCtx.damageType === "string" ? damageCtx.damageType.trim() : "";
      damageTypeForResist = DAMAGE_TYPES.includes(rawAfter.toLowerCase())
        ? rawAfter.toLowerCase()
        : null;

      if (amountAfterSource !== beforeEe) {
        if (source) {
          breakdown.push({
            key: "sourceResistance",
            source,
            sourceLabel: source,
            reduction: beforeEe - amountAfterSource,
            from: beforeEe,
            to: amountAfterSource,
          });
        } else {
          breakdown.push({
            key: "easyEffects",
            reduction: beforeEe - amountAfterSource,
            from: beforeEe,
            to: amountAfterSource,
          });
        }
      }

      const poolChanged = poolsAfter.join(",") !== pools.join(",");
      const typeChanged = rawAfter !== eeDamageType;
      if (poolChanged || typeChanged) {
        breakdown.push({
          key: "convert",
          fromPool: pools.join(","),
          toPool: poolsAfter.join(","),
          fromType: eeDamageType || "",
          toType: rawAfter || "",
        });
      }
    }

    const actorUpdates = {};
    const appliedEntries = [];

    for (const pool of poolsAfter) {
      const poolData = this.system?.attributes?.[pool];
      if (!poolData) continue;

      const current = Number(poolData.value) || 0;
      const max = Number(poolData.max) || 0;
      let newAmount = amountAfterSource;
      const skipTypeResist = !useOutfitTypeResists || pool === "sp" || pool === "light";

      if (!skipTypeResist) {
        const resist = resolveResistance(this, pool, damageTypeForResist);
        if (resist) {
          const before = newAmount;
          newAmount = Math.floor(newAmount * resist.multiplier);
          breakdown.push({
            key: "resistance",
            pool,
            damageType: resist.damageType,
            level: resist.key,
            multiplier: resist.multiplier,
            reason: resist.reason,
            from: before,
            to: newAmount,
          });
        }
        if (afterResistance) {
          newAmount = Math.max(0, newAmount + afterResistance);
          breakdown.push({
            key: "afterResistance",
            pool,
            amount: afterResistance,
            to: newAmount,
          });
        }
      }

      if (newAmount === 0 && op !== "heal") {
        breakdown.push({ key: "final", amount: 0, pool, heal: false });
        continue;
      }

      if (op === "heal") {
        const uncapped = current + newAmount;
        const next = Math.clamp(uncapped, 0, max);
        if (next === current) {
          breakdown.push({ key: "final", amount: 0, pool, heal: true });
          continue;
        }

        const path = poolValuePath(pool);
        actorUpdates[path] = next;
        appliedEntries.push({ pool, path, pre: current, post: next });

        const applied = Math.abs(current - next);
        if (uncapped !== next) {
          breakdown.push({
            key: "clamp",
            pool,
            from: Math.abs(current - uncapped),
            to: applied,
            reason: uncapped > max ? "max" : "min",
          });
        }
        breakdown.push({ key: "final", amount: applied, pool, heal: true });
        continue;
      }

      // Temp absorbs before the pools (hp/st/sp).
      let remaining = newAmount;
      const tempKey = tempPoolKey(pool);
      if (tempKey) {
        const temp = Math.max(0, Number(poolData.temp) || 0);
        if (temp > 0 && remaining > 0) {
          const absorbed = Math.min(temp, remaining);
          remaining -= absorbed;
          const nextTemp = temp - absorbed;
          const tempPath = poolTempPath(pool);
          actorUpdates[tempPath] = nextTemp;
          appliedEntries.push({ pool: tempKey, path: tempPath, pre: temp, post: nextTemp });
          breakdown.push({
            key: "temp", pool, absorbed, from: temp, to: nextTemp,
          });
        }
      }

      if (remaining === 0) {
        breakdown.push({ key: "final", amount: newAmount, pool: tempKey || pool, heal: false });
        continue;
      }

      const uncapped = current - remaining;
      const next = Math.clamp(uncapped, 0, max);
      if (next === current) {
        breakdown.push({ key: "final", amount: 0, pool, heal: false });
        continue;
      }

      const path = poolValuePath(pool);
      actorUpdates[path] = next;
      appliedEntries.push({ pool, path, pre: current, post: next });

      const applied = Math.abs(current - next);
      if (uncapped !== next) {
        breakdown.push({
          key: "clamp",
          pool,
          from: Math.abs(current - uncapped),
          to: applied,
          reason: uncapped > max ? "max" : "min",
        });
      }
      breakdown.push({ key: "final", amount: applied, pool, heal: false });
    }

    if (appliedEntries.length) {
      await this.update(actorUpdates);
    }

    const appliedDamage = buildAppliedDamage(this, appliedEntries, breakdown);
    if (createMessage && (appliedEntries.length || breakdown.length)) {
      if (op === "heal") appliedDamage.isHealing = true;
      await postDamageTakenMessage(this, appliedDamage);
    }
    return appliedEntries.length || breakdown.length ? appliedDamage : null;
  }

  /**
   * Reverse a prior applyDamage
   * @param {object} appliedDamage
   */
  async undoDamage(appliedDamage) {
    if (!appliedDamage?.updates?.length) return;

    const actorUpdates = {};
    for (const update of appliedDamage.updates) {
      const currentValue = foundry.utils.getProperty(this, update.path);
      if (typeof currentValue === "number") {
        const poolKey = String(update.path).match(/attributes\.(\w+)\.value/)?.[1];
        const max = poolKey ? Number(this.system?.attributes?.[poolKey]?.max) || null : null;
        let restored = currentValue + update.value;
        if (max !== null) restored = Math.clamp(restored, 0, max);
        actorUpdates[update.path] = restored;
      }
    }
    if (!Object.keys(actorUpdates).length) return;
    await this.update(actorUpdates, { PMTTRPG: { damageUndo: true } });
  }

  /**
   * Scrolling text helper method.
   *
   * @param {number} delta Difference to display.
   * @param {number} max Maximum value to calculate against.
   * @param {string} suffix Text to display
   * @param {object} overrideOptions Override options to pass to the token method.
   * @param {"hp"|"st"|"sp"|null} [pool=null]
   */
  showScrollingText(delta, max, suffix="", overrideOptions={}, pool=null) {
    const tokens = this.isToken ? [this.token?.object] : this.getActiveTokens(true);
    if (tokens.length > 0) {
      if (!delta) delta = 0;

      const poolColors = {
        st: 0xffcc00,
        sp: 0x4a9eff,
      };
      let color = poolColors[pool];
      if (color === undefined) {
        color = 0x999999;
        if (delta < 0) color = 0xcc0000;
        else if (delta > 0) color = 0x00cc00;
      }

      for ( let token of tokens ) {
        const pct = delta !== 0 ? Math.clamp(Math.abs(delta) / max, 0, 1) : 0.25;
        let content = delta !== 0 ? delta.signedString() + " " + suffix : suffix;
        let textOptions = {
          anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
          direction: CONST.TEXT_ANCHOR_POINTS.TOP,
          fontSize: 16 + (32 * pct),
          fill: color,
          stroke: 0x000000,
          strokeThickness: 4,
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

    const poolAnchors = {
      hp: CONST.TEXT_ANCHOR_POINTS.TOP,
      st: CONST.TEXT_ANCHOR_POINTS.CENTER,
      sp: CONST.TEXT_ANCHOR_POINTS.BOTTOM,
      light: CONST.TEXT_ANCHOR_POINTS.BOTTOM,
    };
    const poolLabels = {
      hp: "PMTTRPG.TrackerHP",
      st: "PMTTRPG.TrackerST",
      sp: "PMTTRPG.TrackerSP",
      light: "PMTTRPG.Light",
    };

    for (const pool of APPLY_POOLS) {
      if (updateData.system?.attributes?.[pool]?.value === undefined) continue;
      const original = context.system.attributes?.[pool]?.value ?? null;
      const current = updateData.system.attributes[pool].value ?? null;
      const max = context.system.attributes?.[pool]?.max ?? updateData.system.attributes[pool].max;
      if (isNaN(original) || isNaN(current)) continue;

      const delta = current - original;
      if (delta === 0) continue;
      this.showScrollingText(delta, max, game.i18n.localize(poolLabels[pool]), {
        anchor: poolAnchors[pool],
      }, pool);
    }
  }

  /**
   * Returns the current stack count of a named status on this actor.
   * Count = number of owned items with type 'status' and matching name.
   *
   * @param {string} statusName  e.g. "Burn", "Poise", "Charge"
   * @returns {number}
   */
  getStatusStacks(statusName) {
    const matching = this.items.filter(
      i => i.type === 'status' && i.name === statusName
    );
    if (!matching.length) return 0;

    const usesStacksField = matching.some(i => i.system?.stacks != null);
    if (usesStacksField || matching.length === 1) {
      return matching.reduce(
        (sum, i) => sum + Math.max(0, Number(i.system?.stacks ?? 1) || 0),
        0
      );
    }
    return matching.length;
  }

  /**
   * Max stacks for a status definition (0 = unlimited).
   * @param {Item|object} source
   * @returns {number}
   */
  static _statusStackMax(source) {
    return Math.max(0, Number(source?.system?.stackMax ?? 0) || 0);
  }

  /**
   * Add status stacks, creating the item from the system pack if needed.
   * @param {string} statusName
   * @param {number} [amount=1]
   * @param {Item|object|null} [source=null]  Optional template when not already on the actor / in a pack
   * @returns {Promise<Item[]>}
   */
  async addStatusStacks(statusName, amount = 1, source = null) {
    const add = Math.max(0, Math.trunc(Number(amount) || 0));
    if (add <= 0) return [];

    const matching = this.items.filter(
      i => i.type === 'status' && i.name === statusName
    );

    let sourceItem = matching[0];
    let itemData;
    if (sourceItem) {
      itemData = sourceItem.toObject();
    } else if (source) {
      itemData = typeof source.toObject === "function"
        ? source.toObject()
        : foundry.utils.duplicate(source);
    } else {
      itemData = await ActorPMTTRPG._fetchStatusFromCompendium(statusName);
      if (!itemData) {
        const warning = game.i18n.format("PMTTRPG.StatusNotFound", { name: statusName });
        console.warn(`PMTTRPG | ${warning}`);
        ui.notifications?.warn(warning);
        return [];
      }
    }

    const stackMax = ActorPMTTRPG._statusStackMax(itemData);
    const current = this.getStatusStacks(statusName);
    const room = stackMax > 0 ? Math.max(0, stackMax - current) : add;
    const toAdd = stackMax > 0 ? Math.min(add, room) : add;
    if (toAdd <= 0) return sourceItem ? [sourceItem] : [];

    const nextStacks = current + toAdd;
    const wasAbsent = current <= 0;

    let kept;
    if (matching.length === 0) {
      const created = foundry.utils.duplicate(itemData);
      delete created._id;
      created.system = created.system ?? {};
      created.system.stacks = nextStacks;
      if (stackMax > 0) created.system.stackMax = stackMax;
      const docs = await this.createEmbeddedDocuments('Item', [created]);
      kept = docs[0];
    } else {
      // Merge legacy copies into the kept item.
      kept = matching[0];
      const extras = matching.slice(1).map(i => i.id);
      await kept.update({ 'system.stacks': nextStacks });
      if (extras.length) await this.deleteEmbeddedDocuments('Item', extras);
    }

    if (wasAbsent && kept) {
      Hooks.callAll("pmttrpg.statusApplied", {
        actor: this,
        item: kept,
        statusName,
        stacks: nextStacks,
      });
    }
    return kept ? [kept] : [];
  }

  /**
   * Sets the stack count of a status to an exact value.
   * Adds or removes items as needed.
   *
   * @param {string} statusName
   * @param {number} target
   * @returns {Promise<void>}
   */
  async setStatusStacks(statusName, target) {
    let desired = Math.max(0, Math.trunc(Number(target) || 0));
    const matching = this.items.filter(
      i => i.type === 'status' && i.name === statusName
    );

    const stackMax = matching[0]
      ? ActorPMTTRPG._statusStackMax(matching[0])
      : 0;
    if (stackMax > 0 && desired > 0) desired = Math.min(desired, stackMax);

    if (desired <= 0) {
      if (!matching.length) return;
      const item = matching[0];
      await this.deleteEmbeddedDocuments('Item', matching.map(i => i.id));
      Hooks.callAll("pmttrpg.statusRemoved", {
        actor: this,
        item,
        statusName,
      });
      return;
    }

    const current = this.getStatusStacks(statusName);
    if (current === desired && matching.length === 1) {
      if (Number(matching[0].system?.stacks ?? 1) !== desired) {
        await matching[0].update({ 'system.stacks': desired });
      }
      return;
    }

    const delta = desired - current;
    if (delta > 0) await this.addStatusStacks(statusName, delta);
    else if (delta < 0) await this.removeStatusStacks(statusName, Math.abs(delta));
    else if (matching.length > 1) {
      // The total matches, but legacy copies still need merging.
      await matching[0].update({ 'system.stacks': desired });
      await this.deleteEmbeddedDocuments('Item', matching.slice(1).map(i => i.id));
    }
  }

  /**
   * Remove status stacks, clamping at zero.
   * @param {string} statusName
   * @param {number} [amount=1]
   * @returns {Promise<string[]>}
   */
  async removeStatusStacks(statusName, amount = 1) {
    const remove = Math.max(0, Math.trunc(Number(amount) || 0));
    if (remove <= 0) return [];

    const matching = this.items.filter(
      i => i.type === 'status' && i.name === statusName
    );
    if (!matching.length) return [];

    const current = this.getStatusStacks(statusName);
    const next = Math.max(0, current - remove);
    const item = matching[0];

    if (next <= 0) {
      const deleted = await this.deleteEmbeddedDocuments('Item', matching.map(i => i.id));
      Hooks.callAll("pmttrpg.statusRemoved", {
        actor: this,
        item,
        statusName,
      });
      return deleted;
    }

    const extras = matching.slice(1).map(i => i.id);
    await item.update({ 'system.stacks': next });
    if (extras.length) await this.deleteEmbeddedDocuments('Item', extras);
    return extras;
  }

  /**
   * Searches all loaded compendium packs for a status item by name.
   * Checks Item-type packs only.
   *
   * @param {string} statusName
   * @returns {Promise<object|null>}  Raw item data object, or null if not found.
   */
  static async _fetchStatusFromCompendium(statusName) {
    // Search packs in order — first match wins.
    // You can narrow this by filtering pack.metadata.id if you want to
    // prioritise your own compendium:
    //   e.g. pack.metadata.id === 'projectmoonttrpg.statuses'
    for (const pack of game.packs) {
      if (pack.documentName !== 'Item') continue;

      const index = await pack.getIndex({ fields: ['name', 'type'] });
      const entry = index.find(
        e => e.type === 'status' && e.name === statusName
      );
      if (!entry) continue;

      const doc = await pack.getDocument(entry._id);
      return doc?.toObject() ?? null;
    }

    return null;
  }
}
