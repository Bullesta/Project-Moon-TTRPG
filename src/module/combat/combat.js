import { PMTTRPGUtility } from "../utility.js";
const { renderTemplate } = foundry.applications.handlebars;

const combatTurnSnapshots = new Map();

/**
 * Helper class to handle rendering the custom combat tracker.
 */
export class CombatSidebarPMTTRPG {

  /** Tracks which combatant IDs are currently expanded. Survives re-renders. */
  #expandedIds = new Set();

  startup() {

    // Add support for damage rolls via event delegation.
    Hooks.on('ready', () => {
      // Toggle expand/collapse — delegated so it survives re-renders.
      $('body').on('click', '.ct [data-action="toggleDetails"]', (event) => {
        const $btn = $(event.currentTarget);
        const combatantId = $btn.closest('[data-combatant-id]').data('combatant-id');
        if (!combatantId) return;

        if (this.#expandedIds.has(combatantId)) {
          this.#expandedIds.delete(combatantId);
        } else {
          this.#expandedIds.add(combatantId);
        }

        // Re-render the tracker so the template picks up the new state.
        ui.combat.render();
      });

      // Commit edits to the actor on blur (clicking away).
      $('body').on('blur', '.ct [data-stat-path]', async (event) => {
          const $el = $(event.currentTarget);
          const path = $el.data('stat-path');
          const raw = ($el.is('input') ? $el.val() : $el.text()).trim();
          const value = Number(raw);

          // Bail out if it's not a valid number.
          if (isNaN(value)) {
              ui.combat.render(); // Reset to current value.
              return;
          }

          // combatant.actor covers unlinked tokens as game.actors.get would miss those buggers.
          const combatantId = $el.closest('[data-combatant-id]').data('combatant-id');
          const actor = game.combat?.combatants.get(combatantId)?.actor;
          if (!actor) return;

          console.log(path);
          console.log(value);
          console.log(actor);

          await actor.update({ [path]: value });

          console.log(actor);
      });

      // Prevent Enter from inserting a newline — commit instead.
      $('body').on('keydown', '.ct [data-stat-path]', (event) => {
          if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
          }
      });
    });

    // Re-render combat when actors are modified.
    Hooks.on('updateActor', (actor, data, options, id) => {
      ui.combat.render();
    });

    Hooks.on('deleteCombat', async (combat, _options, userId) => {
      if (game.user.id !== userId) return;
      try {
        const { runAsOwnerOrGM } = await import("../easy-effects/gm-route.js");
        const seen = new Set();
        for (const combatant of combat.combatants ?? []) {
          const actor = combatant?.actor;
          if (!actor || seen.has(actor.id)) continue;
          seen.add(actor.id);
          await runAsOwnerOrGM(actor, "clearRecycledEvade");
        }
      } catch (error) {
        console.warn("[PMTTRPG] recycled evade combat-end clear failed", error);
      }
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

          // Promote round arrivals after end-of-round scripts clear live statuses.
          if (game.user.id === userId) {
            try {
              const { runAsOwnerOrGM } = await import("../easy-effects/gm-route.js");
              await runAsOwnerOrGM(actor, "promotePendingStatuses", { arrival: "round" });
            } catch (error) {
              console.warn("[PMTTRPG] promote pending (round) failed", error);
            }
          }
        }
      }

      if (currentCombatant?.actor) {
        const turnActor = currentCombatant.actor;
        // Promote turn arrivals, refresh action economy, then turn-start hooks.
        if (game.user.id === userId) {
          try {
            const { runAsOwnerOrGM } = await import("../easy-effects/gm-route.js");
            await runAsOwnerOrGM(turnActor, "promotePendingStatuses", { arrival: "turn" });
          } catch (error) {
            console.warn("[PMTTRPG] promote pending (turn) failed", error);
          }
        }
        if (turnActor.isOwner) {
          try {
            await turnActor.refreshActionEconomy();
          } catch (error) {
            console.warn("[PMTTRPG] action economy refresh failed", error);
          }
        }
        await statusMacros.emitTurnStart({
          actor: turnActor,
          actorId: turnActor.id,
          combat,
          combatant: currentCombatant,
          previous: snapshot,
          current: { turn: combat.turn, round: combat.round },
        });
        try {
          Hooks.callAll("pmttrpg.turnStart", {
            actor: turnActor,
            actorId: turnActor.id,
            combat,
            combatant: currentCombatant,
            previous: snapshot,
            current: { turn: combat.turn, round: combat.round },
          });
        } catch (error) {
          console.warn("[EasyEffects] turnStart hook failed", error);
        }
        if (game.user.id === userId) {
          try {
            const { runAsOwnerOrGM } = await import("../easy-effects/gm-route.js");
            await runAsOwnerOrGM(turnActor, "clearRecycledEvade");
          } catch (error) {
            console.warn("[PMTTRPG] recycled evade clear failed", error);
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

      if (game.combat) {
        let combatants = this.getCombatantsData();

        combatants.sort((a, b) => b.combatantData.initiative - a.combatantData.initiative);

        let template = 'systems/projectmoonttrpg/templates/combat/combat-turn-order.hbs';
        let templateData = {
          combatants: combatants
        };

        let content = await foundry.applications.handlebars.renderTemplate(template, templateData)
        newHtml.find('.combat-tracker').remove();
        newHtml.find('.combat-tracker-header').after(content);

        newHtml.find('.combat-tracker-header strong.encounter-title').text(` Round ${game.combat.round} `);
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
        toDelete.push(combatant._id);
        continue;
      }

      const actorData = combatant.actor;

      const mainStats = [
        {
          name: "Health",
          icon: "systems/projectmoonttrpg/assets/icons/sheet/hp_healthy.webp",
          amount: actorData.system.hp.value,
          path: "system.attributes.hp.value",
          percent: (actorData.system.hp.value / actorData.system.hp.max) * 100,
          editable: combatant.isOwner || game.user.isGM
        },
        {
          name: "Stagger",
          icon: "systems/projectmoonttrpg/assets/icons/sheet/01_stagger.webp",
          amount: actorData.system.st.value,
          path: "system.attributes.st.value",
          percent: (actorData.system.st.value / actorData.system.st.max) * 100,
          editable: combatant.isOwner || game.user.isGM
        },
        {
          name: "Sanity",
          icon: "systems/projectmoonttrpg/assets/icons/sheet/SanityIcons_SanityBase.webp",
          amount: actorData.system.sp.value,
          path: "system.attributes.sp.value",
          percent: (actorData.system.sp.value / actorData.system.sp.max) * 100,
          editable: combatant.isOwner || game.user.isGM
        }
      ];
      const detailedStats = [
        {
          name: "Actions",
          icon: "systems/projectmoonttrpg/assets/icons/sheet/Attack_Action.webp",
          amount: actorData.system.attributes.actions.value,
          path: "system.attributes.actions.value",
          max: actorData.system.attributes.actions.max,
          percent: (actorData.system.attributes.actions.value / actorData.system.attributes.actions.max) * 100,
          editable: combatant.isOwner || game.user.isGM
        },
        {
          name: "Reactions",
          icon: "systems/projectmoonttrpg/assets/icons/sheet/Action_Reaction.webp",
          amount: actorData.system.attributes.reactions.value,
          path: "system.attributes.reactions.value",
          max: actorData.system.attributes.reactions.max,
          percent: (actorData.system.attributes.reactions.value / actorData.system.attributes.reactions.max) * 100,
          editable: combatant.isOwner || game.user.isGM
        },
        {
          name: "Movement",
          icon: "systems/projectmoonttrpg/assets/icons/sheet/Action_Movement.webp",
          amount: actorData.system.attributes.squares.remaining,
          max: actorData.system.attributes.squares.max,
          percent: actorData.system.attributes.squares.max
            ? (actorData.system.attributes.squares.remaining / actorData.system.attributes.squares.max) * 100
            : 0,
          editable: combatant.isOwner || game.user.isGM
        },
        {
          name: "Light",
          icon: "systems/projectmoonttrpg/assets/icons/sheet/00_light.webp",
          path: "system.light.value",
          amount: actorData.system.light.value,
          max: actorData.system.light.max,
          percent: (actorData.system.light.value / actorData.system.light.max) * 100,
          editable: combatant.isOwner || game.user.isGM
        }
      ];
      let isCurrentTurn = false;

      if(combatant === game.combat.combatant) {
        isCurrentTurn = true;
      }

      combatants.push({
        combatantData: combatant,
        actorData,
        mainStats,
        detailedStats,
        isCurrentTurn,
        isExpanded: this.#expandedIds.has(combatant._id),
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