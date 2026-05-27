import { PMTTRPGUtility } from "../utility.js";
import { PMTTRPGRolls } from "../rolls.js";
const { renderTemplate } = foundry.applications.handlebars;

function normalizeEffectEntries(rawEffects = []) {
  if (!Array.isArray(rawEffects)) return [];

  return rawEffects.map((entry) => {
    const stackRaw = Number(entry?.stack ?? entry?.count ?? 1);
    const stack = Math.max(1, Math.min(5, Number.isFinite(stackRaw) ? stackRaw : 1));
    const costRaw = Number(entry?.cost ?? 0);
    const cost = Number.isFinite(costRaw) ? costRaw : 0;
    const mode = entry?.mode === 'negative' ? 'negative' : 'positive';

    return {
      effectUuid: entry?.effectUuid ?? '',
      name: entry?.name ?? '',
      cost,
      stack,
      count: stack,
      mode,
      appliesTo: entry?.appliesTo ?? '',
      canPositive: entry?.canPositive !== false,
      canNegative: entry?.canNegative !== false,
      procOn: entry?.procOn ?? 'alwaysActive',
      procResult: entry?.procResult ?? 'none',
      procStat: entry?.procStat ?? 'any',
      procDice: entry?.procDice ?? 'any',
      procAction: entry?.procAction ?? 'any',
      procCondition: entry?.procCondition ?? '',
      positive: entry?.positive ?? '',
      negative: entry?.negative ?? '',
      macro: foundry.utils.mergeObject({ uuid: '' }, entry?.macro ?? {}, { inplace: false })
    };
  });
}

function getEffectSignature(entry) {
  return [
    entry?.effectUuid || entry?.name || '',
    entry?.procOn || '',
    entry?.procResult || '',
    entry?.procStat || '',
    entry?.procDice || '',
    entry?.procAction || '',
    entry?.procCondition || '',
    entry?.mode || ''
  ].join('|').toLowerCase();
}

function computeEffectSummary(entries = [], epMax = 0) {
  let positiveSpent = 0;
  let negativeSpent = 0;
  const signatureCounts = new Map();

  for (const entry of entries) {
    const cost = Math.abs(Number(entry?.cost ?? 0));
    const count = Math.max(1, Number(entry?.stack ?? entry?.count ?? 1));
    const signature = getEffectSignature(entry);
    signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);

    if (entry?.mode === 'negative') {
      negativeSpent += cost * count;
    }
    else {
      positiveSpent += cost * count;
    }
  }

  const cap = Number.isFinite(epMax) ? epMax : 0;
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

export class ItemPMTTRPG extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    super.prepareData();

    // Get the Item's data
    const itemData = this;
    const actorData = this.actor ? this.actor : {};
    const data = itemData.system;
    const effectProcOn = data.procOn ?? 'alwaysActive';

    // Clean up broken groups.
    if (itemData.type == 'class') {
      if (itemData.system.equipment) {
        for (let [group_key, group] of Object.entries(itemData.system.equipment)) {
          if (group) {
            if (PMTTRPGUtility.isEmpty(group['items'])) {
              group['items'] = [];
              group['objects'] = [];
            }
          }
        }
      }
    }

    if (itemData.type == 'weapon') {
      const baseDieSides = 10;
      let diceMaxBonus = 0;
      let dicePowerFromHand = 0;
      let dicePowerFromAttack = 0;

      switch (data.formProperty) {
      case 'medium':
      case 'highCaliber':
        diceMaxBonus += 2;
        break;
      default:
        break;
      }

      switch (data.handProperty) {
      case 'off1h':
        dicePowerFromHand += 1;
        break;
      case 'off2h':
        dicePowerFromHand += 2;
        break;
      default:
        break;
      }

      dicePowerFromAttack = Number(actorData?.system?.attributes?.attackModifier?.value ?? 0);
      const dicePowerTotal = dicePowerFromHand + dicePowerFromAttack;
      const dieSides = baseDieSides + diceMaxBonus;
      const baseFormula = `1d${dieSides}`;
      const powerSuffix = dicePowerTotal === 0 ? '' : (dicePowerTotal > 0 ? `+${dicePowerTotal}` : `${dicePowerTotal}`);

      data.offensiveDiceComputed = `${baseFormula}${powerSuffix}`;
      data.diceMaxBonus = diceMaxBonus;
      data.dicePowerFromHand = dicePowerFromHand;
      data.dicePowerFromAttack = dicePowerFromAttack;
      data.dicePowerTotal = dicePowerTotal;
      // Compute Effect Points (EP) for weapons: (Rank*2)+2, minimum 0.
      const rank = Number(data.rank ?? 0);
      const weaponEpBase = rank < 0 ? 0 : (rank * 2) + 2;
      // Hand properties may add EP (e.g., 2H weapons grant +2 EP)
      let epBonusFromHands = 0;
      switch (data.handProperty) {
      case 'off2h':
      case 'def2h':
        epBonusFromHands += 2;
        break;
      default:
        break;
      }
      data.epBase = weaponEpBase;
      data.epBonusFromHands = epBonusFromHands;
      data.epMax = weaponEpBase + epBonusFromHands + (Number(data.bonusEP) || 0);
      const normalizedEffects = normalizeEffectEntries(data.effects);
      data.effects = normalizedEffects;
      data.effectsSummary = computeEffectSummary(normalizedEffects, Number(data.epMax ?? 0));
    }

    if (itemData.type == 'outfit') {
      const blockBaseSides = 10;
      const evadeBaseSides = 12;
      let blockPower = 0;
      let evadePower = 0;
      data.bonusLight = 0;
      data.bonusEP = 0;

      switch (data.outfitProperty) {
      case 'armored':
        blockPower += 1;
        break;
      case 'swift':
        evadePower += 1;
        break;
      case 'balanced':
        data.bonusLight = 1;
        data.bonusEP = 2;
        break;
      default:
        break;
      }

      data.blockDicePower = blockPower;
      data.evadeDicePower = evadePower;
      data.blockDiceComputed = `1d${blockBaseSides}${blockPower ? (blockPower > 0 ? `+${blockPower}` : `${blockPower}`) : '+0'}`;
      data.evadeDiceComputed = `1d${evadeBaseSides}${evadePower ? (evadePower > 0 ? `+${evadePower}` : `${evadePower}`) : '+0'}`;

      data.resistanceLevels = {
        fatal: { label: 'PMTTRPG.ResistanceFatal', multiplier: 2 },
        weak: { label: 'PMTTRPG.ResistanceWeak', multiplier: 1.5 },
        normal: { label: 'PMTTRPG.ResistanceNormal', multiplier: 1 },
        endured: { label: 'PMTTRPG.ResistanceEndured', multiplier: 0.5 },
        ineffective: { label: 'PMTTRPG.ResistanceIneffective', multiplier: 0.25 },
        immune: { label: 'PMTTRPG.ResistanceImmune', multiplier: 0 }
      };

      data.resistanceTypes = {
        slash: 'PMTTRPG.DamageTypeSlash',
        pierce: 'PMTTRPG.DamageTypePierce',
        blunt: 'PMTTRPG.DamageTypeBlunt'
      };

      data.resistances = data.resistances || {};
      data.resistances.hp = data.resistances.hp || {};
      data.resistances.st = data.resistances.st || {};
      for (let damageType of ['slash', 'pierce', 'blunt']) {
        data.resistances.hp[damageType] = data.resistances.hp[damageType] || 'normal';
        data.resistances.st[damageType] = data.resistances.st[damageType] || 'normal';
      }
      // Compute EP for outfits: (Rank*2)+2, minimum 0. Add outfit property bonusEP.
      const orank = Number(data.rank ?? 0);
      const outfitEpBase = orank < 0 ? 0 : (orank * 2) + 2;
      data.epBase = outfitEpBase;
      data.epMax = outfitEpBase + (Number(data.bonusEP) || 0);
      const normalizedEffects = normalizeEffectEntries(data.effects);
      data.effects = normalizedEffects;
      data.effectsSummary = computeEffectSummary(normalizedEffects, Number(data.epMax ?? 0));
      // Compute human-readable multiplier strings for template display, e.g. "2x", "1.5x", "0.25x", "0x"
      data.resistancesDisplay = { hp: {}, st: {} };
      const formatMultiplier = (m) => {
        if (m === 0) return '0x';
        // Ensure consistent formatting (no trailing .0)
        return `${Number.isInteger(m) ? m : m}${'x'}`;
      };
      for (let damageType of ['slash', 'pierce', 'blunt']) {
        const hpKey = data.resistances.hp[damageType];
        const stKey = data.resistances.st[damageType];
        const hpMult = data.resistanceLevels?.[hpKey]?.multiplier ?? 1;
        const stMult = data.resistanceLevels?.[stKey]?.multiplier ?? 1;
        data.resistancesDisplay.hp[damageType] = formatMultiplier(hpMult);
        data.resistancesDisplay.st[damageType] = formatMultiplier(stMult);
      }
    }

    if (itemData.type == 'skill') {
      const rank = Math.max(0, Number(data.rank ?? 0));
      const lightCost = Math.max(1, Number(data.lightCost ?? 1));
      const actorLightMax = Number(actorData?.system?.attributes?.light?.max ?? 0);

      data.rank = rank;
      data.lightCost = lightCost;
      // EP formula: (Rank * 2) + ((Light Cost - 1) * Rank) + 2 [+ 2 if innate]
      const innate = !!data.innate;
      const skillEpBase = rank < 0 ? 0 : (rank * 2) + 2;
      const skillEpMax = skillEpBase + ((lightCost - 1) * rank) + (innate ? 2 : 0);
      data.epBase = skillEpBase;
      data.epMax = skillEpMax;
      const normalizedEffects = normalizeEffectEntries(data.effects);
      data.effects = normalizedEffects;
      data.effectsSummary = computeEffectSummary(normalizedEffects, Number(data.epMax ?? 0));
      data.lightCostMax = actorLightMax > 0 ? actorLightMax : null;
    }

    if (itemData.type == 'status') {
      data.isStatus = true;
      data.proc = foundry.utils.mergeObject({
        turnStart: false,
        endOfRound: false,
        actionOrReaction: false,
        attackerBurst: false,
        onHitWhenActorHas: false,
        onHitWhenTargetHas: false,
        alwaysActive: false,
        skillEffect: false,
      }, data.proc ?? {}, { inplace: false });
      data.macro = foundry.utils.mergeObject({
        uuid: '',
      }, data.macro ?? {}, { inplace: false });
    }

    if (itemData.type == 'effect') {
      const effectProcOn = data.procOn ?? 'alwaysActive';
      data.appliesTo = data.appliesTo ?? 'weapon';
      data.canPositive = data.canPositive !== false;
      data.canNegative = data.canNegative !== false;
      data.procOn = data.procOn ?? 'alwaysActive';
      data.procResult = data.procResult ?? 'none';
      data.procStat = data.procStat ?? 'any';
      data.procDice = data.procDice ?? 'any';
      data.procAction = data.procAction ?? 'any';
      data.procCondition = data.procCondition ?? '';
      data.positive = data.positive ?? '';
      data.negative = data.negative ?? '';
      data.macro = foundry.utils.mergeObject({
        uuid: '',
      }, data.macro ?? {}, { inplace: false });
      data.showProcResult = ['onClashResult', 'onEitherClashResult'].includes(effectProcOn);
      data.showProcStat = ['onCondition', 'onUse', 'onAction'].includes(effectProcOn);
      data.showProcDice = ['onClash', 'onClashResult', 'onEitherClashResult', 'onBurst', 'onCritical', 'onDevastating'].includes(effectProcOn);
      data.showProcAction = ['onUse', 'onAction'].includes(effectProcOn);
    }
  }

  async _getEquipmentObjects(force_reload = false) {
    let obj = null;
    let itemData = this;

    let items = await PMTTRPGUtility.getEquipment(force_reload);
    let equipment = [];

    if (itemData.system.equipment) {
      for (let [group, group_items] of Object.entries(itemData.system.equipment)) {
        if (group_items) {
          equipment[group] = items.filter(i => group_items['items'].includes(i.id));
        }
      }
    }

    return equipment;
  }

  /** @override */
  getRollData() {
    return this.actor ? {
      ...super.getRollData(),
      ...this.actor.getRollData()
    } : super.getRollData();
  }

  /**
   * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
   * @return {Promise}
   */
  async roll({ configureDialog = true, mode = 'block', ammo = null, consumeAmmo = true } = {}) {
    if (this.type == 'skill') {
      return PMTTRPGRolls.doSkillRoll({
        actor: this.actor,
        skill: this,
        templateData: {
          image: this.img,
          title: this.name,
          details: this.system.description,
        }
      });
    }

    if (this.type == 'outfit') {
      const formula = mode == 'evade' ? this.system.evadeDiceComputed : this.system.blockDiceComputed;
      const flavor = mode == 'evade' ? 'PMTTRPG.Evade' : 'PMTTRPG.Def';
      PMTTRPGRolls.rollMove({
        actor: this.actor,
        data: this,
        formula: formula,
        templateData: {
          image: this.img,
          title: this.name,
          flavor: game.i18n.localize(flavor),
          rollType: 'defense',
          defenseType: mode
        }
      });
      return;
    }

    if (this.type == 'weapon' && ammo) {
      const ammoQuantity = Number(ammo.system?.quantity ?? 0);
      if (ammoQuantity <= 0) return;

      if (consumeAmmo) {
        await ammo.update({ 'system.quantity': Math.max(0, ammoQuantity - 1) });
      }

      PMTTRPGRolls.rollMove({
        actor: this.actor,
        data: this,
        templateData: {
          image: this.img,
          title: `${this.name} - ${ammo.name}`,
          trigger: null,
          details: this.system.description,
          rollType: 'damage',
          ammoName: ammo.name,
          ammoType: ammo.system?.ammoType ?? null,
          ammoDamageType: ammo.system?.damageType ?? null
        }
      });
      return;
    }

    if (this.type == 'weapon' && this.system.weaponType == 'ranged') {
      const ammoOptions = this.actor?.items.filter(item => item.type === 'ammunition' && Number(item.system?.quantity ?? 0) > 0) ?? [];

      if (ammoOptions.length <= 0) {
        ui.notifications.warn(game.i18n.localize('PMTTRPG.Dialog.noAvailableAmmunition'));
        return;
      }

      if (configureDialog) {
        const dialogData = {
          weapon: {
            name: this.name,
            img: this.img,
            offensiveDiceComputed: this.system.offensiveDiceComputed
          },
          ammoOptions: ammoOptions.map((item, index) => ({
            id: item.id,
            name: item.name,
            img: item.img,
            quantity: Number(item.system?.quantity ?? 0),
            ammoType: item.system?.ammoType ?? null,
            damageType: item.system?.damageType ?? null,
            isDefault: index === 0,
            ammoTypeLabel: item.system?.ammoType ? game.i18n.localize(`PMTTRPG.Ammo${item.system.ammoType[0].toUpperCase()}${item.system.ammoType.slice(1)}`) : null,
            damageTypeLabel: item.system?.damageType ? game.i18n.localize(`PMTTRPG.DamageType${item.system.damageType[0].toUpperCase()}${item.system.damageType.slice(1)}`) : null
          }))
        };

        const html = await renderTemplate('systems/projectmoonttrpg/templates/dialog/weapon-ammo-dialog.html', dialogData);
        const dlgOptions = {
          classes: ['projectmoonttrpg', 'PMTTRPG-dialog']
        };

        if (PMTTRPGUtility.nightmode) dlgOptions.classes.push('nightmode');

        new Dialog({
          title: game.i18n.localize('PMTTRPG.Dialog.chooseAmmunition'),
          content: html,
          buttons: {
            shoot: {
              label: game.i18n.localize('PMTTRPG.Dialog.roll'),
              callback: html => {
                const form = html[0].querySelector('form');
                const ammoId = form.ammoId.value;
                const consume = form.consumeAmmo.checked;
                const chosenAmmo = this.actor.items.get(ammoId);

                if (!chosenAmmo) return;

                this.roll({
                  configureDialog: false,
                  ammo: chosenAmmo,
                  consumeAmmo: consume
                });
              }
            },
            cancel: {
              label: game.i18n.localize('PMTTRPG.Dialog.cancel')
            }
          }
        }, dlgOptions).render(true);
        return;
      }
    }

    PMTTRPGRolls.rollMove({actor: this.actor, data: this});
  }
}