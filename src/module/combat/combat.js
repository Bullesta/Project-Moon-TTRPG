import { PMTTRPGUtility } from "../utility.js";
const { renderTemplate } = foundry.applications.handlebars;

const combatTurnSnapshots = new Map();

/**
 * Helper class to handle rendering the custom combat tracker.
 */
export class CombatSidebarPMTTRPG {
  startup() {

    // Add support for damage rolls via event delegation.
    Hooks.on('ready', () => {
      // Damage rolls from the combat tracker.
      $('body').on('click', '.PMTTRPG-rollable', (event) => {
        let $self = $(event.currentTarget);
        let $actorElem = $self.parents('.actor-elem');
        let combatant_id = $actorElem.length > 0 ? $actorElem.attr('data-combatant-id') : null;
        if (combatant_id) {
          let combatant = game.combat.combatants.get(combatant_id);
          let actor = combatant.actor ? combatant.actor : null;
          if (actor) {
            actor._onRoll(event, actor);
          }
        }
      });
    });

    // Re-render combat when actors are modified.
    Hooks.on('updateActor', (actor, data, options, id) => {
      ui.combat.render();
    });

    Hooks.on('preUpdateCombat', (combat, updateData) => {
      if (updateData.turn === undefined && updateData.round === undefined) return;
      combatTurnSnapshots.set(combat.id, {
        turn: combat.turn,
        round: combat.round,
        combatantId: combat.combatant?.id ?? null,
      });
    });

    Hooks.on('updateCombat', async (combat, updateData, options, userId) => {
      const snapshot = combatTurnSnapshots.get(combat.id);
      if (!snapshot) return;
      combatTurnSnapshots.delete(combat.id);

      if (snapshot.turn === combat.turn && snapshot.round === combat.round) return;

      const statusMacros = game.projectmoonttrpg?.statusMacros;
      if (!statusMacros) return;

      const currentCombatant = combat.combatant ?? null;
      const prevRound = Number(snapshot.round ?? 0);
      const nextRound = Number(combat.round ?? 0);
      const roundEnded = nextRound > prevRound && prevRound >= 1;

      if (roundEnded) {
        const seenActors = new Set();
        const current = { turn: combat.turn, round: combat.round };
        for (const combatant of combat.combatants) {
          const actor = combatant?.actor;
          if (!actor || seenActors.has(actor.id)) continue;
          seenActors.add(actor.id);

          const payload = {
            actor,
            actorId: actor.id,
            combat,
            combatant,
            previous: snapshot,
            current,
          };

          await statusMacros.emitEndOfRound(payload);
          try {
            Hooks.callAll("pmttrpg.endOfRound", payload);
          } catch (error) {
            console.warn("[EasyEffects] endOfRound hook failed", error);
          }
        }
      }

      if (currentCombatant?.actor) {
        await statusMacros.emitTurnStart({
          actor: currentCombatant.actor,
          actorId: currentCombatant.actor.id,
          combat,
          combatant: currentCombatant,
          previous: snapshot,
          current: { turn: combat.turn, round: combat.round },
        });
        try {
          Hooks.callAll("pmttrpg.turnStart", {
            actor: currentCombatant.actor,
            actorId: currentCombatant.actor.id,
            combat,
            combatant: currentCombatant,
            previous: snapshot,
            current: { turn: combat.turn, round: combat.round },
          });
        } catch (error) {
          console.warn("[EasyEffects] turnStart hook failed", error);
        }
        // The Action Economy refreshes at the start of the character's turn.
        if (currentCombatant.actor.isOwner) {
          try {
            await currentCombatant.actor.refreshActionEconomy();
          } catch (error) {
            console.warn("[PMTTRPG] action economy refresh failed", error);
          }
        }
      }
    });

    Hooks.on('updateToken', (scene, token, data, options, id) => {
      if (data.actorData) {
        ui.combat.render();
      }
    });

    // When the combat tracker is rendered, we need to completely replace
    // its HTML with a custom version.
    Hooks.on('renderCombatTracker', async (app, html, options) => {
      // Find the combat element, which is where combatants are stored.
      let newHtml = $(html).find('#combat');
      if (newHtml.length < 1) {
        newHtml = $(html);
      }

      // If there's as combat, we can proceed.
      if (game.combat) {
        // Retrieve a list of the combatants grouped by actor type and sorted
        // by their initiative count.
        let combatants = this.getCombatantsData();

        console.log(JSON.stringify(combatants));

        // Get the custom template.
        let template = 'systems/projectmoonttrpg/templates/combat/combat-turn-order.hbs';
        let templateData = {
          combatants: combatants
        };

        // Render the template and update the markup with our new version.
        let content = await foundry.applications.handlebars.renderTemplate(template, templateData)
        newHtml.find('.combat-tracker').remove();
        newHtml.find('.combat-tracker-header').after(content);
      }
    });
  }

  /**
   * Retrieve a flat, initiative-sorted list of combatants for the current combat.
   *
   * @param {Object}   [options]
   * @returns {Array}
   */
  getCombatantsData() {
    if (!game.combat) return [];

    const toDelete = [];
    const combatants = [];

    for (const combatant of game.combat.combatants) {
      if (!combatant.actor) {
        toDelete.push(combatant.id);
        continue;
      }

      const actorData = canvas.tokens.get(combatant.tokenId).actor;

      const mainStats = [
        {
          name: "Health",
          icon: "systems/projectmoonttrpg/assets/icons/sheet/hp_healthy.webp",
          amount: actorData.system.hp.value,
          percent: (actorData.system.hp.value / actorData.system.hp.max) * 100
        },
        {
          name: "Stagger",
          icon: "systems/projectmoonttrpg/assets/icons/sheet/01_stagger.webp",
          amount: actorData.system.st.value,
          percent: (actorData.system.st.value / actorData.system.st.max) * 100
        },
        {
          name: "Sanity",
          icon: "systems/projectmoonttrpg/assets/icons/sheet/SanityIcons_SanityBase.webp",
          amount: actorData.system.sp.value,
          percent: (actorData.system.sp.value / actorData.system.sp.max) * 100
        }
      ];
      const detailedStats = [];

      combatants.push({
        combatantData: combatant,
        actorData,
        mainStats,
        detailedStats,
        editable: combatant.isOwner || game.user.isGM
      })
    }

    // Clean up orphaned combatants in one batch call.
    if (toDelete.length) {
      game.combat.deleteEmbeddedDocuments('Combatant', toDelete);
    }

    // Sort by initiative, pushing null/undefined initiative to the end.
    combatants.sort((a, b) => {
      if (a.initiative == null) return 1;
      if (b.initiative == null) return -1;
      return Number(a.initiative) - Number(b.initiative);
    });

    return combatants;
  }
}
