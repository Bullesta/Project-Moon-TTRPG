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
