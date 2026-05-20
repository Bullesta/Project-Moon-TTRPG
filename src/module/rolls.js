import { PMTTRPGUtility } from "./utility.js";
const { renderTemplate } = foundry.applications.handlebars;

export class PMTTRPGRolls {

  constructor() {
    this.actor = null;
    this.actorData = null;
    this.item = null;
  }

  static getRollFormula(defaultFormula = '2d6') {
    // TODO: Incorporate adv/dis/ongoing/forward.
    return defaultFormula;
  }

  static getModifiers(actor) {
    let forward = Number(actor.system.attributes?.forward?.value) ?? 0;
    let ongoing = Number(actor.system.attributes?.ongoing?.value) ?? 0;
    let result = '';
    if (forward) result += `+${forward}`;
    if (ongoing) result += `+${ongoing}`;
    return result;
  }

  static getSkillTypeLabel(skillType) {
    switch (skillType) {
    case 'attack':
      return game.i18n.localize('PMTTRPG.SkillTypeAttack');
    case 'block':
      return game.i18n.localize('PMTTRPG.SkillTypeBlock');
    case 'evade':
      return game.i18n.localize('PMTTRPG.SkillTypeEvade');
    case 'stat':
      return game.i18n.localize('PMTTRPG.SkillTypeStatUse');
    default:
      return skillType;
    }
  }

  static getSkillOptions(actor, skillType) {
    if (!actor) return [];

    const items = actor.items.filter(item => skillType === 'attack' ? item.type === 'weapon' : item.type === 'outfit') ?? [];
    const isAttack = skillType === 'attack';

    return items
      .map(item => {
        const isEquipped = !!item.system?.equipped;
        const formula = isAttack
          ? (item.system?.offensiveDiceComputed || '1d10')
          : (skillType === 'block'
            ? (item.system?.blockDiceComputed || '1d10')
            : (item.system?.evadeDiceComputed || '1d12'));

        return {
          id: item.id,
          name: item.name,
          img: item.img,
          formula,
          damageType: isAttack ? (item.system?.damageType ?? null) : null,
          typeLabel: isAttack ? game.i18n.localize('PMTTRPG.Weapon') : game.i18n.localize('PMTTRPG.Outfits'),
          isEquipped,
          isDefault: isEquipped,
        };
      })
      .sort((left, right) => {
        if (left.isDefault === right.isDefault) return left.name.localeCompare(right.name);
        return left.isDefault ? -1 : 1;
      });
  }

  static async promptSkillRoll({ actor, skill, skillType, options = [] } = {}) {
    if (!actor || !skill) return null;

    const defaultOption = options.find(option => option.isDefault) ?? options[0] ?? null;
    const dialogData = {
      skill: {
        name: skill.name,
        img: skill.img,
        typeLabel: this.getSkillTypeLabel(skillType),
        lightCost: Number(skill.system?.lightCost ?? 0),
        description: skill.system?.description ?? '',
      },
      options,
      selectedOption: defaultOption,
      consumeLight: true,
    };

    const html = await renderTemplate('systems/projectmoonttrpg/templates/dialog/skill-roll-dialog.html', dialogData);
    const dlgOptions = {
      classes: ['projectmoonttrpg', 'PMTTRPG-dialog']
    };

    if (PMTTRPGUtility.nightmode) dlgOptions.classes.push('nightmode');

    return new Promise(resolve => {
      new Dialog({
        title: game.i18n.format('PMTTRPG.Dialog.skillRollTitle', { skill: skill.name }),
        content: html,
        buttons: {
          roll: {
            label: game.i18n.localize('PMTTRPG.Dialog.roll'),
            callback: html => {
              const form = html[0].querySelector('form');
              resolve({
                itemId: form.itemId?.value ?? defaultOption?.id ?? null,
                consumeLight: !!form.consumeLight?.checked,
              });
            }
          },
          cancel: {
            label: game.i18n.localize('PMTTRPG.Dialog.cancel'),
            callback: () => resolve(null)
          }
        },
        close: () => resolve(null)
      }, dlgOptions).render(true);
    });
  }

  static async doSkillRoll({ actor, skill, templateData = {} } = {}) {
    if (!actor || !skill) return false;

    this.actor = actor;
    this.actorData = actor.system ?? {};
    this.item = null;

    const skillType = skill.system?.skillType ?? 'attack';
    if (skillType === 'stat') {
      const statKey = skill.system?.stat || 'for';
      const statLabel = game.i18n.localize(`PMTTRPG.Ability${statKey[0].toUpperCase()}${statKey.slice(1)}`);
      return this.doStatRoll({
        actor,
        stat: statKey,
        label: statLabel,
        templateData: foundry.utils.mergeObject(templateData, {
          image: skill.img,
          title: skill.name,
          details: skill.system?.description ?? ''
        }, { inplace: false })
      });
    }

    const options = this.getSkillOptions(actor, skillType);
    if (!options.length) {
      ui.notifications.warn(game.i18n.localize(skillType === 'attack' ? 'PMTTRPG.Notifications.noWeaponWarning' : 'PMTTRPG.Notifications.noOutfitWarning'));
      return false;
    }

    const promptResult = await this.promptSkillRoll({ actor, skill, skillType, options });
    if (!promptResult) return false;

    const selectedOption = options.find(option => option.id === promptResult.itemId) ?? options[0];
    if (!selectedOption) return false;

    const lightCost = Math.max(0, Number(skill.system?.lightCost ?? 0));
    if (promptResult.consumeLight && lightCost > 0) {
      const currentLight = Number(actor.system?.attributes?.light?.value ?? 0);
      await actor.update({
        'system.attributes.light.value': Math.max(0, currentLight - lightCost)
      });
    }

    const isAttack = skillType === 'attack';
    const flavor = game.i18n.format('PMTTRPG.Dialog.usingSkillWith', { item: selectedOption.name });
    const rollType = isAttack ? 'damage' : 'defense';

    return this.rollMove({
      actor,
      formula: selectedOption.formula,
      templateData: foundry.utils.mergeObject(templateData, {
        image: skill.img,
        title: skill.name,
        flavor,
        details: skill.system?.description ?? '',
        rollType,
        defenseType: isAttack ? null : skillType,
        damageType: selectedOption.damageType,
        skillName: skill.name,
        skillUseName: selectedOption.name,
        skillUseFormula: selectedOption.formula,
      }, { inplace: false })
    });
  }

  static async promptStatRoll(abilityLabel, rollMode = 'def') {
    let dialogData = {
      abilityLabel,
      rollMode
    };
    const html = await renderTemplate('systems/projectmoonttrpg/templates/dialog/stat-roll-dialog.html', dialogData);
    const dlgOptions = {
      classes: ['projectmoonttrpg', 'PMTTRPG-dialog']
    };

    if (PMTTRPGUtility.nightmode) dlgOptions.classes.push('nightmode');

    return new Promise(resolve => {
      new Dialog({
        title: game.i18n.format('PMTTRPG.Dialog.statRollTitle', { ability: abilityLabel }),
        content: html,
        buttons: {
          roll: {
            label: game.i18n.localize('PMTTRPG.Dialog.roll'),
            callback: html => {
              const form = html[0].querySelector('form');
              resolve({
                rollMode: form.advantage.value,
                modifier: Number(form.modifier.value) || 0
              });
            }
          },
          cancel: {
            label: game.i18n.localize('PMTTRPG.Dialog.cancel'),
            callback: () => resolve(null)
          }
        },
        close: () => resolve(null)
      }, dlgOptions).render(true);
    });
  }

  static async doStatRoll({ actor, stat, label = null, templateData = {}, statModifier = 0 } = {}) {
    if (!actor || !stat) return false;

    this.actor = actor;
    this.actorData = actor.system ?? {};
    this.item = null;

    const abilityLabel = label ?? game.i18n.localize(`PMTTRPG.${stat.toUpperCase()}`);
    const rollDialog = await this.promptStatRoll(abilityLabel, actor.flags?.projectmoonttrpg?.rollMode ?? 'def');
    if (!rollDialog) return false;

    await this.actor.setFlag('projectmoonttrpg', 'rollMode', rollDialog.rollMode);

    return this.rollMove({
      actor,
      formula: stat,
      templateData,
      statModifier: Number(statModifier) + rollDialog.modifier
    });
  }

  static async rollMove(options = {}) {
    let dice = this.getRollFormula('2d6');

    // TODO: Create a way to resolve this using the formula only, sans actor.
    // If there's no actor, we need to exit.
    if (!options.actor) {
      return false;
    }

    // If there's no formula or item, we need to exit.
    if (!options.formula && !options.data) {
      return false;
    }

    // Grab the actor data.
    this.actor = options.actor;
    this.actorData = this.actor ? this.actor.system : {};
    let actorType = this.actor.type;

    // Grab the item data, if any.
    this.item = options?.data;

    // Grab the formula, if any.
    let formula = options.formula ?? null;
    let label = options?.data?.label ?? '';
    
    // Grab the stat modifier (from stat roll dialog), if any.
    let statModifier = options?.statModifier ?? 0;

    // Prepare template data for the roll.
    let templateData = options.templateData ? foundry.utils.duplicate(options.templateData): {};
    let data = {};

    let dlgOptions = {
      classes: ['projectmoonttrpg', 'PMTTRPG-dialog']
    };

    if (PMTTRPGUtility.nightmode) dlgOptions.classes.push('nightmode');

    // Handle item rolls (moves).
    if (this.item) {
      // Handle moves.
      if (this.item.type == 'move' || this.item.type == 'npcMove') {
        formula = dice;
        templateData = {
          image: this.item.img,
          title: this.item.name,
          trigger: null,
          details: this.item.system.description,
          moveResults: this.item.system.moveResults,
          choices: this.item.system.choices
        };

        if (this.item.type == 'npcMove' || this.item.system?.rollType == 'FORMULA') {
          data.roll = this.item.system.rollFormula;
          data.rollType = this.item.system.rollType ? this.item.system.rollType.toLowerCase() : 'npc';
        }
        else {
          data.roll = this.item.system.rollType.toLowerCase();
          data.rollType = this.item.system.rollType.toLowerCase();
        }
        data.mod = this.item.type == 'move' ? this.item.system.rollMod : 0;
        // If this is an ASK roll, render a bond first to determine which
        // score to use.
        if (data.roll == 'ask') {
          let stats = Object.keys(this.actorData.abilities);
          let statButtons = {};

          for (let stat of stats) {
            statButtons[stat] = {
              label: game.i18n.localize(`PMTTRPG.${stat.toUpperCase()}`),
              callback: () => this.rollMoveExecute(stat, data, templateData)
            };
          }
          new Dialog({
            title: game.i18n.localize('PMTTRPG.Dialog.askTitle'),
            content: `<p>${game.i18n.format('PMTTRPG.Dialog.askContent', {name: this.item.name})}`,
            buttons: statButtons
          }, dlgOptions).render(true);
        }
        // If this is a PROMPT roll, render a different bond to let the user
        // enter their bond value.
        else if (data.roll == 'bond') {
          let template = 'systems/projectmoonttrpg/templates/chat/roll-dialog.html';
          let dialogData = {
            title: game.i18n.format('PMTTRPG.Dialog.bondContent', {name: this.item.name}),
            bond: null
          };
          const html = await renderTemplate(template, dialogData);
          return new Promise(resolve => {
            new Dialog({
              title: game.i18n.localize('PMTTRPG.Dialog.bondTitle'),
              content: html,
              buttons: {
                submit: {
                  label: 'Roll',
                  callback: html => {
                    this.rollMoveExecute('bond', data, templateData, html[0].querySelector("form"))
                  }
                }
              }
            }, dlgOptions).render(true);
          })

        }
        // Otherwise, grab the data from the move and pass it along.
        else {
          this.rollMoveExecute(data.roll, data, templateData);
        }
      }
      // Handle spells.
      else if (this.item.type == 'spell') {
        templateData = {
          image: this.item.img,
          title: this.item.name,
          trigger: null,
          details: this.item.system.description
        };
        data.roll = this.item.system.rollFormula;
        this.rollMoveExecute(data.roll, data, templateData);
      }
      // Handle equipment.
      else if (this.item.type == 'equipment') {
        templateData = {
          image: this.item.img,
          title: this.item.name,
          trigger: null,
          details: this.item.system.description,
          tags: this.item.system.tags
        }
        data.roll = this.item.system.rollFormula;
        this.rollMoveExecute(data.roll, data, templateData);
      }
      else if (this.item.type == 'weapon') {
        templateData = foundry.utils.mergeObject({
          image: this.item.img,
          title: this.item.name,
          trigger: null,
          details: this.item.system.description,
          rollType: 'damage'
        }, templateData);
        data.roll = this.item.system.offensiveDiceComputed;
        this.rollMoveExecute(data.roll, data, templateData);
      }
    }
    // Handle formula-only rolls.
    else {
      this.rollMoveExecute(formula, data, templateData, null, statModifier);
    }
  }

  static async rollMoveExecute(roll, dataset, templateData, form = null, statModifier = 0) {
    // Render the roll.
    let template = 'systems/projectmoonttrpg/templates/chat/chat-move.html';
    let dice = PMTTRPGUtility.getRollFormula('2d6');
    let forwardUsed = false;
    let rollModeUsed = false;
    let resultRangeNeeded = false;
    let rollData = this.actor.getRollData();
    // GM rolls.
    let chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor })
    };
    let rollMode = game.settings.get("core", "rollMode");
    if (["gmroll", "blindroll"].includes(rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user.id];
    if (rollMode === "blindroll") chatData["blind"] = true;
    // Define tags.
    let baseTags = this.item?.system?.tags ?? this.actor?.system?.tags;
    let tags = [];
    let hasPiercingTag = false;
    let hasDmgBonusTag = false;
    let hasIgnoreArmorTag = false;
    if (baseTags && baseTags.length > 0) {
      tags = JSON.parse(baseTags);
      if (baseTags.includes('piercing')) {
        hasPiercingTag = true;
      }
      if (baseTags.includes('damage')) {
        hasDmgBonusTag = true;
      }
      if (baseTags.includes('ignores armor')) {
        hasIgnoreArmorTag = true;
      }
    }
    // Add piercing and armor tags.
    if (this.item?.system?.itemType == 'weapon' || templateData?.rollType == 'damage') {
      let piercing = this.actor.system.attributes.damage?.piercing ?? 0;
      let dmgBonus = this.actor.system.attributes.damage?.dmgBonus ?? 0;
      let ignoreArmor = this.actor.system.attributes.damage?.ignoreArmor ?? false;
      if (piercing > 0 && !hasPiercingTag) tags.push({value: `${piercing} piercing`});
      if (ignoreArmor && !hasIgnoreArmorTag) tags.push({value: `ignores armor`});
      if (dmgBonus > 0 && !hasDmgBonusTag) tags.push({value: `+${dmgBonus} damage`});
      if (this.actor.type == 'npc' && templateData?.flavor) tags.push({value: templateData.flavor});
    }
    templateData.tags = JSON.stringify(tags);
    // Handle dice rolls.
    if (!PMTTRPGUtility.isEmpty(roll)) {
      // Test if the roll is a formula.
      let validRoll = false;
      try {
        validRoll = await (new Roll(roll.trim(), rollData).evaluate());
      } catch (error) {
        validRoll = false;
      }
      // Roll can be either a formula like `2d6+3` or a raw stat like `str`.
      let formula = validRoll ? roll.trim() : '';
      // Handle bond (user input).
      if (!validRoll || dataset?.rollType == 'formula') {
        if (roll.toLowerCase() == 'bond') {
          formula = form.bond?.value ? `${dice}+${form.bond.value}` : dice;
          if (dataset.value && dataset.value != 0) {
            formula += `+${dataset.value}`;
          }
        }
        else if (dataset?.rollType == 'formula') {
          formula = roll;
        }
        // Handle ability scores (no input).
        else if (roll.match(/(\d*)d\d+/g)) {
          formula = roll;
        }
        // Handle moves.
        else {
          // Determine if the stat toggle is in effect.
          let toggleModifier = 0;
          formula = `${dice}+${this.actorData.abilities[roll].mod}${toggleModifier ? '+' + toggleModifier : ''}`;
          if (dataset.mod && dataset.mod != 0) {
            formula += `+${dataset.mod}`;
          }
          // Add stat modifier from dialog (if provided)
          if (statModifier && statModifier != 0) {
            formula += statModifier > 0 ? `+${statModifier}` : `${statModifier}`;
          }
        }

        // Handle formula overrides.
        let formulaOverride = this.actor.system.attributes?.rollFormula?.value;
        if (formulaOverride && formula.includes('2d6')) {
          let overrideIsValid = false;
          try {
            overrideIsValid = await (new Roll(formulaOverride.trim(), rollData).evaluate());
          }
          catch (error) {
            overrideIsValid = false;
          }

          if (overrideIsValid) formula = formula.replace('2d6', formulaOverride);
        }

        if (formula.includes('2d6') || formulaOverride && formula.includes(formulaOverride)) {
          resultRangeNeeded = true;
        }

        // Handle adv/dis.
        let rollMode = this.actor.flags?.projectmoonttrpg?.rollMode ?? 'def';
        switch (rollMode) {
          case 'adv':
            rollModeUsed = true;
            if (formula.includes('2d6')) {
              formula = formula.replace('2d6', '3d6kh2');
            }
            else if (formula.includes('d6')) {
              // Match the first d6 as (n)d6.
              formula = formula.replace(/(\d*)(d6)/, (match, p1, p2, offset, string) => {
                let keep = p1 ? Number(p1) : 1;
                let count = keep + 1;
                return `${count}d6kh${keep}`; // Ex: 2d6 -> 3d6kh2
              });
            }
            break;

          case 'dis':
            rollModeUsed = true;
            if (formula.includes('2d6')) {
              formula = formula.replace('2d6', '3d6kl2');
            }
            else if (formula.includes('d6')) {
              formula = formula.replace(/(\d*)(d6)/, (match, p1, p2, offset, string) => {
                let keep = p1 ? Number(p1) : 1;
                let count = keep + 1;
                return `${count}d6kl${keep}`;
              });
            }
            break;
        }

        // Append the modifiers.
        let modifiers = PMTTRPGRolls.getModifiers(this.actor);
        formula = `${formula}${modifiers}`;
        forwardUsed = Number(this.actor.system.attributes?.forward?.value) != 0;
      }
      if (formula != null) {
        // Do the roll.
        let roll = new Roll(`${formula}`, rollData);
        await (roll.evaluate());
        let rollType = templateData.rollType ?? 'none';
        // Add success notification.
        if (resultRangeNeeded || rollType == 'move') {
          // Retrieve the result ranges.
          let resultRanges = CONFIG.PMTTRPG.rollResults;
          let resultType = null;
          // Iterate through each result range until we find a match.
          for (let [resultKey, resultRange] of Object.entries(resultRanges)) {
            // Grab the start and end.
            let start = resultRange.start;
            let end = resultRange.end;
            // If both are present, roll must be between them.
            if (start && end) {
              if (roll.total >= start && roll.total <= end) {
                resultType = resultKey;
                break;
              }
            }
            // If start only, treat it as greater than or equal to.
            else if (start) {
              if (roll.total >= start) {
                resultType = resultKey;
                break;
              }
            }
            // If end only, treat it as less than or equal to.
            else if (end) {
              if (roll.total <= end) {
                resultType = resultKey;
                break;
              }
            }
          }

          // Handle XP.
          const token = canvas.tokens.controlled.find(t => t.actorId == this.actor.id);
          // @todo determine if this should be the canvas ID or the actor ID.
          templateData.tokenId = token ? `${canvas.scene.id}.${token.id}` : null;
          templateData.xp = resultType == 'failure' ? true : false;

          // Update the templateData.
          templateData.resultLabel = resultRanges[resultType]?.label ?? resultType;
          templateData.result = resultType;
          templateData.resultDetails = null;
          if (templateData?.moveResults && templateData.moveResults[resultType]?.value) {
            templateData.resultDetails = templateData.moveResults[resultType].value;
          }
        }
        // Render it.
        templateData.actor = this.actor;
        roll.render().then(r => {
          templateData.rollPMTTRPG = r;
          templateData.roll = roll;
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

    // Update the combat flags.
    if (game.combat && game.combat.combatants) {
      let combatant = game.combat.combatants.find(c => c.actor.id == this.actor.id);
      if (combatant) {
        let moveCount = combatant.flags.projectmoonttrpg ? combatant.flags.projectmoonttrpg.moveCount : 0;
        moveCount = moveCount ? Number(moveCount) + 1 : 1;
        // Emit a socket for the GM client.
        if (!game.user.isGM) {
          game.socket.emit('system.projectmoonttrpg', {
            combatantUpdate: { _id: combatant.id, 'flags.projectmoonttrpg.moveCount': moveCount }
          });
        }
        else {
          await game.combat.updateEmbeddedDocuments('Combatant', [{ _id: combatant.id, 'flags.projectmoonttrpg.moveCount': moveCount }]);
          ui.combat.render();
        }
      }
    }

    // Update forward.
    if (forwardUsed || rollModeUsed) {
      let updates = {};
      if (forwardUsed) updates['system.attributes.forward.value'] = 0;
      if (rollModeUsed && game.settings.get('projectmoonttrpg', 'advForward')) {
        updates['flags.projectmoonttrpg.rollMode'] = 'def';
      }
      await this.actor.update(updates);
    }
  }
}
