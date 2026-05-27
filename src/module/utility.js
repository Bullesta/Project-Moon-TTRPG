export class PMTTRPGUtility {
  static cleanClass(string) {
    //Lower case everything
    string = string.toLowerCase();
    //Make alphanumeric (removes all other characters)
    string = string.replace(/[^a-z0-9\s]/g, "");
    //Convert whitespaces and underscore to dash
    string = string.replace(/[\s\_]/g, "-");
    //Clean up multiple dashes or whitespaces
    string = string.replace(/[\s\-]+/g, "-");
    return string;
  };

  static isEmpty(arg) {
    return [null, false, undefined, 0, ''].includes(arg);
  }

  static async getEquipment(update = false) {
    if (typeof game.items == 'undefined') {
      return false;
    }

    // Cache results.
    if (game.projectmoonttrpg.equipment && !update) {
      return game.projectmoonttrpg.equipment;
    }

    // Load new results.
    let items = game.items.filter(i => i.type == 'equipment');
    for (let pack of game.packs) {
      if (pack.metadata.name.includes('equipment')) {
        if (pack) {
          items = items.concat(await pack.getDocuments());
        }
      }
    }

    game.projectmoonttrpg.equipment = items;

    return items;
  }

  static getRollFormula(defaultFormula = '2d6') {
    // TODO: Add support for adv/dis/ongoing/forward.
    return defaultFormula;
  }

  static getAbilityMod(abilityScore, force=false) {
    return abilityScore;
  }

  static getAbilityScore(abilityMod, force=false) {
    return abilityMod;
  }

  static expandEffectText(text, stack = 1) {
    if (!text) return '';

    const stackValue = Number(stack);
    if (!Number.isFinite(stackValue)) {
      return `${text}`;
    }

    return `${text}`.replace(/\[(N(?:\s*[+\-*/]\s*-?\d+(?:\.\d+)?)?)\]/gi, (match, expression) => {
      const normalized = `${expression}`.replace(/\s+/g, '').toUpperCase();
      if (normalized === 'N') {
        return `${stackValue}`;
      }

      const parts = normalized.match(/^N([+\-*/])(-?\d+(?:\.\d+)?)$/);
      if (!parts) {
        return match;
      }

      const operator = parts[1];
      const operand = Number(parts[2]);
      if (!Number.isFinite(operand)) {
        return match;
      }

      let result = stackValue;
      switch (operator) {
      case '+':
        result += operand;
        break;
      case '-':
        result -= operand;
        break;
      case '*':
        result *= operand;
        break;
      case '/':
        if (operand === 0) return match;
        result /= operand;
        break;
      default:
        return match;
      }

      return Number.isInteger(result) ? `${result}` : `${result}`;
    });
  }

  static formatEffectProcLabel(effect = {}) {
    const procOn = `${effect?.procOn ?? 'alwaysActive'}`;
    const procResult = `${effect?.procResult ?? 'none'}`;
    const procStat = `${effect?.procStat ?? 'any'}`;
    const procCondition = `${effect?.procCondition ?? ''}`.trim();

    const resultLabel = procResult === 'lose'
      ? game.i18n.localize('PMTTRPG.EffectProcResultLose')
      : procResult === 'win'
        ? game.i18n.localize('PMTTRPG.EffectProcResultWin')
        : '';

    const labels = {
      alwaysActive: game.i18n.localize('PMTTRPG.EffectProcAlwaysActive'),
      onCondition: procCondition ? `${game.i18n.localize('PMTTRPG.EffectProcOnCondition')} ${procCondition}` : game.i18n.localize('PMTTRPG.EffectProcOnCondition'),
      onClash: resultLabel ? `${game.i18n.localize('PMTTRPG.EffectProcOnClash')} ${resultLabel}` : game.i18n.localize('PMTTRPG.EffectProcOnClash'),
      onClashResult: resultLabel ? `${game.i18n.localize('PMTTRPG.EffectProcOnClash')} ${resultLabel}` : game.i18n.localize('PMTTRPG.EffectProcOnClash'),
      onEitherClashResult: resultLabel ? `${game.i18n.localize('PMTTRPG.EffectProcOnEitherClashResult').replace('[Result]', resultLabel)}` : game.i18n.localize('PMTTRPG.EffectProcOnEitherClashResult').replace(' [Result]', ''),
      onUse: game.i18n.localize('PMTTRPG.EffectProcOnUse'),
      onBurst: game.i18n.localize('PMTTRPG.EffectProcOnBurst'),
      onCritical: game.i18n.localize('PMTTRPG.EffectProcOnCritical'),
      onDevastating: game.i18n.localize('PMTTRPG.EffectProcOnDevastating'),
      onAction: game.i18n.localize('PMTTRPG.EffectProcOnAction')
    };

    let heading = labels[procOn] ?? procOn;
    const extraParts = [];

    if (['onUse', 'onAction'].includes(procOn) && procStat !== 'any' && procStat !== 'offensive' && procStat !== 'defensive') {
      extraParts.push(effect?.procStat === 'for' ? game.i18n.localize('PMTTRPG.AbilityFor') : effect?.procStat === 'pru' ? game.i18n.localize('PMTTRPG.AbilityPru') : effect?.procStat === 'jus' ? game.i18n.localize('PMTTRPG.AbilityJus') : effect?.procStat === 'cha' ? game.i18n.localize('PMTTRPG.AbilityCha') : effect?.procStat === 'ins' ? game.i18n.localize('PMTTRPG.AbilityIns') : effect?.procStat === 'tem' ? game.i18n.localize('PMTTRPG.AbilityTem') : procStat);
    }

    if (extraParts.length) {
      heading = `${heading}, ${extraParts.join(', ')}`;
    }

    return heading;
  }

  static getProgressCircle({ current = 100, max = 100, radius = 16 }) {
    let circumference = radius * 2 * Math.PI;
    let percent = current < max ? current / max : 1;
    let percentNumber = percent * 100;
    let offset = circumference - (percent * circumference);
    let strokeWidth = 4;
    let diameter = (radius * 2) + strokeWidth;
    let colorClass = Math.round((percent * 100) / 10) * 10;

    return {
      radius: radius,
      diameter: diameter,
      strokeWidth: strokeWidth,
      circumference: circumference,
      offset: offset,
      position: diameter / 2,
      color: 'red',
      class: colorClass,
    };
  }

  static async loadCompendia(slug) {

    const compendium = []

    const noCompendiumAutoData = game.settings.get('projectmoonttrpg', 'noCompendiumAutoData');
    if (!noCompendiumAutoData) {
      const pack_id = `projectmoonttrpg.${slug}`;
      const pack = game.packs.get(pack_id);
      compendium.push(...(pack ? await pack.getDocuments() : []));
    }

    const compendiumPrefix = game.settings.get('projectmoonttrpg', 'compendiumPrefix');
    if (compendiumPrefix != '') {
      const pack_id = `${compendiumPrefix.toLowerCase()}-${slug}`;
      const pack = game.packs.find(p => {return p.metadata?.name?.indexOf(pack_id) >= 0});
      compendium.push(...(pack ? await pack.getDocuments() : []));
    }

    return compendium

  }

  static get nightmode() {
    return document.querySelector('body').classList.contains('theme-dark');
  }
}
