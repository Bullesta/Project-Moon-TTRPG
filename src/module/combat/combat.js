import { PMTTRPGUtility } from "../utility.js";
import { emitCombatEnd, emitCombatStart, emitEndOfRound, emitEndOfTurn, emitStartOfRound, emitTurnStart } from "../easy-effects/registry.js";
import { beginCombatLifecyclePass, endCombatLifecyclePass } from "../status/lifecycle-pass.js";
import { rollInitiative } from "../targeting.js";
const { renderTemplate } = foundry.applications.handlebars;

const combatTurnSnapshots = new Map();
const combatEndSeen = new WeakSet();
const combatStartActors = new WeakMap();
const combatEndActors = new WeakMap();
const combatEndCombatants = new WeakSet();

function combatHasBegun(combat) {
  return Boolean(combat?.started || Number(combat?.round ?? 0) >= 1);
}

function actorIdSet(map, combat) {
  let set = map.get(combat);
  if (!set) {
    set = new Set();
    map.set(combat, set);
  }
  return set;
}

function rememberCombatStart(combat, actorId) {
  if (!combat || !actorId) return false;
  const set = actorIdSet(combatStartActors, combat);
  if (set.has(actorId)) return false;
  set.add(actorId);
  return true;
}

function forgetCombatStart(combat, actorId) {
  if (!combat || !actorId) return;
  combatStartActors.get(combat)?.delete(actorId);
}

function rememberCombatEnd(combat, actorId) {
  if (!combat || !actorId) return false;
  const set = actorIdSet(combatEndActors, combat);
  if (set.has(actorId)) return false;
  set.add(actorId);
  return true;
}

function forgetCombatEnd(combat, actorId) {
  if (!combat || !actorId) return;
  combatEndActors.get(combat)?.delete(actorId);
}

function otherCombatantForActor(combat, actorId, exceptCombatantId) {
  for (const entry of combat?.combatants ?? []) {
    if (exceptCombatantId && entry.id === exceptCombatantId) continue;
    if (entry.actor?.id === actorId) return true;
  }
  return false;
}

function resolveCombatUserId(userId) {
  if (!userId) return game.user.id;
  return typeof userId === "string" ? userId : userId.id;
}

/**
 * [On Combat Start] for one person in the fight.
 * Does nothing until Begin Combat, and skips anyone who already got it.
 */
export async function emitCombatStartForCombatant(combat, combatant, userId) {
  const resolvedUserId = resolveCombatUserId(userId);
  if (game.user.id !== resolvedUserId) return;
  if (!combatHasBegun(combat)) return;
  const actor = combatant?.actor;
  if (!actor) return;
  forgetCombatEnd(combat, actor.id);
  if (!rememberCombatStart(combat, actor.id)) return;

  beginCombatLifecyclePass();
  try {
    await emitCombatStart({
      actor,
      actorId: actor.id,
      combat,
      combatant,
    });
  } catch (error) {
    console.warn("[EasyEffects] combatStart failed", error);
  } finally {
    endCombatLifecyclePass();
  }
}

/**
 * [On Combat End] when someone is pulled out of a fight that's still going.
 */
export async function emitCombatEndForCombatant(combat, combatant, userId) {
  const resolvedUserId = resolveCombatUserId(userId);
  if (game.user.id !== resolvedUserId) return;
  if (!combat || combatEndSeen.has(combat)) return;
  if (!combatHasBegun(combat)) return;
  if (combatant && combatEndCombatants.has(combatant)) return;
  const actor = combatant?.actor;
  if (!actor) return;
  if (otherCombatantForActor(combat, actor.id, combatant.id)) return;
  if (combatant) combatEndCombatants.add(combatant);
  forgetCombatStart(combat, actor.id);
  if (!rememberCombatEnd(combat, actor.id)) return;

  beginCombatLifecyclePass();
  try {
    await emitCombatEnd({
      actor,
      actorId: actor.id,
      combat,
      combatant,
    });
  } catch (error) {
    console.warn("[EasyEffects] combatEnd failed", error);
  } finally {
    endCombatLifecyclePass();
  }
}

/**
 * [On Combat End] for everyone still in the fight, right before Combat is deleted.
 */
export async function emitCombatEndForEncounter(combat, userId) {
  if (!combat || combatEndSeen.has(combat)) return;
  const resolvedUserId = resolveCombatUserId(userId);
  if (game.user.id !== resolvedUserId) return;
  if (!combatHasBegun(combat)) return;
  combatEndSeen.add(combat);

  beginCombatLifecyclePass();
  try {
    const seen = new Set();
    for (const combatant of combat.combatants ?? []) {
      const actor = combatant?.actor;
      if (!actor || seen.has(actor.id)) continue;
      seen.add(actor.id);
      if (!rememberCombatEnd(combat, actor.id)) continue;
      try {
        await emitCombatEnd({
          actor,
          actorId: actor.id,
          combat,
          combatant,
        });
      } catch (error) {
        console.warn("[EasyEffects] combatEnd failed", error);
      }
    }
  } finally {
    endCombatLifecyclePass();
  }
}

const TRACKER_REVEAL_FLAG = "revealTracker";
const TRACKER_REVEAL_KEYS = Object.freeze([
  "initiative",
  "hp",
  "st",
  "sp",
  "actions",
  "reactions",
  "movement",
  "light",
]);

function isWorldTrackerRevealAll() {
  return game.settings.get("projectmoonttrpg", "showCombatTrackerToPlayers") === true;
}

function trackerElement(target) {
  return target instanceof HTMLElement
    ? target
    : (target?.[0] instanceof HTMLElement ? target[0] : null);
}

function trackerRevealRaw(combatant) {
  return combatant?.getFlag("projectmoonttrpg", TRACKER_REVEAL_FLAG);
}

function isBulkTrackerReveal(combatant) {
  return trackerRevealRaw(combatant) === true;
}

function getRevealMap(combatant) {
  const raw = trackerRevealRaw(combatant);
  if (raw === true) {
    return Object.fromEntries(TRACKER_REVEAL_KEYS.map((key) => [key, true]));
  }
  if (raw && typeof raw === "object") return { ...raw };
  return {};
}

function isStatRevealed(combatant, key) {
  const raw = trackerRevealRaw(combatant);
  if (raw === true) return true;
  return raw?.[key] === true;
}

function isAnyStatRevealed(combatant) {
  const raw = trackerRevealRaw(combatant);
  if (raw === true) return true;
  if (!raw || typeof raw !== "object") return false;
  return TRACKER_REVEAL_KEYS.some((key) => raw[key] === true);
}

function revealKeyFromTarget(target) {
  const el = trackerElement(target);
  const ctx = el?.closest("[data-tracker-context]");
  return ctx?.dataset?.revealKey ?? null;
}

function trackerRevealUpdate(value) {
  const path = `flags.projectmoonttrpg.${TRACKER_REVEAL_FLAG}`;
  if (typeof globalThis._replace === "function") {
    return { [path]: globalThis._replace(value) };
  }
  return { [`flags.projectmoonttrpg.==${TRACKER_REVEAL_FLAG}`]: value };
}

async function writeTrackerReveal(combatant, value) {
  const current = trackerRevealRaw(combatant);
  const next = value === true ? true : (value && typeof value === "object" ? { ...value } : null);

  if (next == null) {
    if (current === undefined) return;
    return combatant.unsetFlag("projectmoonttrpg", TRACKER_REVEAL_FLAG);
  }

  return combatant.update(trackerRevealUpdate(next));
}

async function setBulkTrackerReveal(combatant) {
  return writeTrackerReveal(combatant, true);
}

async function clearTrackerReveal(combatant) {
  return writeTrackerReveal(combatant, null);
}

async function setStatRevealed(combatant, key, revealed) {
  if (!TRACKER_REVEAL_KEYS.includes(key)) return;
  if (revealed === isStatRevealed(combatant, key)) return;

  const map = getRevealMap(combatant);
  if (revealed) map[key] = true;
  else delete map[key];

  const remaining = TRACKER_REVEAL_KEYS.filter((entry) => map[entry] === true);
  if (!remaining.length) return writeTrackerReveal(combatant, null);

  return writeTrackerReveal(
    combatant,
    Object.fromEntries(remaining.map((entry) => [entry, true]))
  );
}

function statRevealLabel(key) {
  return game.i18n.localize(`PMTTRPG.Combat.Stat.${key}`);
}

/**
 * Combatant for a tracker card. `data-combatant-id` is the Combatant id,
 * not the Actor (unlinked tokens share a world actor).
 */
function combatantFromTrackerCard(target) {
  const el = trackerElement(target);
  const card = el?.closest("[data-combatant-id]");
  const id = card?.dataset?.combatantId;
  if (!id) return null;
  return game.combat?.combatants.get(id) ?? null;
}

function combatantCanvasToken(combatant) {
  if (!canvas.ready) return null;
  const token = combatant?.token?.object ?? null;
  if (!token || token.scene?.id !== canvas.scene?.id) return null;
  return token;
}

function canPingOrPanCombatant(combatant) {
  const token = combatantCanvasToken(combatant);
  if (!token) return false;
  return game.user.isGM || token.isVisible;
}

/**
 * Custom combat tracker. Context menu is bound once on document.body.
 */
export class CombatSidebarPMTTRPG {

  /** Tracks which combatant IDs are currently expanded. Survives re-renders. */
  #expandedIds = new Set();

  /* Delegated to the document body so replacing tracker HTML does not drop the listener. */
  #combatantContextMenu = null;

  startup() {
    game.settings.register("projectmoonttrpg", "showCombatTrackerToPlayers", {
      name: "PMTTRPG.Settings.showCombatTrackerToPlayers.name",
      hint: "PMTTRPG.Settings.showCombatTrackerToPlayers.hint",
      scope: "world",
      config: true,
      restricted: true,
      type: Boolean,
      default: false,
      onChange: () => ui.combat?.render(),
    });

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
          const combatant = game.combat?.combatants.get(combatantId);
          const actor = combatant?.actor;
          if (!actor || !(combatant.isOwner || game.user.isGM)) return;

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

      this.#bindCombatantContextMenu();
    });

    // Re-render combat when actors are modified.
    Hooks.on('updateActor', (actor, data, options, id) => {
      ui.combat.render();
    });

    // Actor updates do not cover Combatant flags (per-combatant tracker reveal).
    Hooks.on('updateCombatant', (combatant) => {
      if (combatant.parent?.id !== game.combat?.id) return;
      ui.combat.render();
    });

    Hooks.on('preDeleteCombat', async (combat, _options, userId) => {
      await emitCombatEndForEncounter(combat, userId);
    });

    Hooks.on("createCombatant", async (combatant, _options, userId) => {
      const combat = combatant?.combat ?? combatant?.parent;
      await emitCombatStartForCombatant(combat, combatant, userId);
    });

    Hooks.on("preDeleteCombatant", async (combatant, _options, userId) => {
      const combat = combatant?.combat ?? combatant?.parent;
      await emitCombatEndForCombatant(combat, combatant, userId);
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

      beginCombatLifecyclePass();
      try {
        const currentCombatant = combat.combatant ?? null;
        const prevRound = Number(snapshot.round ?? 0);
        const nextRound = Number(combat.round ?? 0);
        const roundEnded = nextRound > prevRound && prevRound >= 1;
        const roundStarted = nextRound > prevRound;
        const combatStarted = prevRound < 1 && nextRound >= 1;
        const current = { turn: combat.turn, round: combat.round };

        const eachCombatActor = async (fn) => {
          const seenActors = new Set();
          for (const combatant of combat.combatants) {
            const actor = combatant?.actor;
            if (!actor || seenActors.has(actor.id)) continue;
            seenActors.add(actor.id);
            await fn({
              actor,
              actorId: actor.id,
              combat,
              combatant,
              previous: snapshot,
              current,
            });
          }
        };

        const previousCombatant = snapshot.combatantId
          ? combat.combatants.get(snapshot.combatantId) ?? null
          : null;
        const previousActor = previousCombatant?.actor ?? null;
        if (prevRound >= 1 && previousActor && game.user.id === userId) {
          const endTurnPayload = {
            actor: previousActor,
            actorId: previousActor.id,
            combat,
            combatant: previousCombatant,
            previous: snapshot,
            current,
          };
          try {
            await emitEndOfTurn(endTurnPayload);
          } catch (error) {
            console.warn("[EasyEffects] endOfTurn failed", error);
          }
        }

        if (roundEnded) {
          await eachCombatActor(async (payload) => {
            await statusMacros.emitEndOfRound(payload);
            if (game.user.id === userId) {
              try {
                await emitEndOfRound(payload);
              } catch (error) {
                console.warn("[EasyEffects] endOfRound failed", error);
              }
              try {
                const { runAsOwnerOrGM } = await import("../easy-effects/gm-route.js");
                await runAsOwnerOrGM(payload.actor, "promotePendingStatuses", { arrival: "round" });
              } catch (error) {
                console.warn("[PMTTRPG] promote pending (round) failed", error);
              }
            }
          });
        }

        if (combatStarted) {
          await eachCombatActor(async (payload) => {
            await emitCombatStartForCombatant(payload.combat, payload.combatant, userId);
          });
        }

        if (roundStarted) {
          await eachCombatActor(async (payload) => {
            await statusMacros.emitStartOfRound(payload);
            if (game.user.id === userId) {
              try {
                await emitStartOfRound(payload);
              } catch (error) {
                console.warn("[EasyEffects] startOfRound failed", error);
              }
            }
            try {
              payload.actor.prepareData();
            } catch (error) {
              console.warn("[PMTTRPG] prepareData after startOfRound failed", error);
            }
          });
        }

        if (currentCombatant?.actor) {
          const turnActor = currentCombatant.actor;
          const turnPayload = {
            actor: turnActor,
            actorId: turnActor.id,
            combat,
            combatant: currentCombatant,
            previous: snapshot,
            current: { turn: combat.turn, round: combat.round },
          };
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
          await statusMacros.emitTurnStart(turnPayload);
          if (game.user.id === userId) {
            try {
              await emitTurnStart(turnPayload);
            } catch (error) {
              console.warn("[EasyEffects] turnStart failed", error);
            }
            try {
              const { runAsOwnerOrGM } = await import("../easy-effects/gm-route.js");
              await runAsOwnerOrGM(turnActor, "clearRecycledEvade");
            } catch (error) {
              console.warn("[PMTTRPG] recycled evade clear failed", error);
            }
          }
        }
      } finally {
        endCombatLifecyclePass();
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

        newHtml.find('.combat-tracker-header strong.encounter-title').text(
          game.i18n.format("PMTTRPG.Combat.Round", { round: game.combat.round })
        );
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
      const canEdit = combatant.isOwner || game.user.isGM;
      const canObserve = actorData.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
      const revealAll = isWorldTrackerRevealAll();
      const showFull = canObserve || revealAll;
      const showStat = (key) => showFull || isStatRevealed(combatant, key);
      const anyRevealed = isAnyStatRevealed(combatant);
      const showRevealEye = (key) => game.user.isGM && !revealAll && isStatRevealed(combatant, key);
      const showHiddenEye = (key) => game.user.isGM && !revealAll && anyRevealed && !isStatRevealed(combatant, key);

      const mainStats = [
        {
          key: "hp",
          name: statRevealLabel("hp"),
          icon: "systems/projectmoonttrpg/assets/icons/sheet/hp_healthy.webp",
          amount: actorData.system.hp.value,
          path: "system.attributes.hp.value",
          percent: (actorData.system.hp.value / actorData.system.hp.max) * 100,
          editable: canEdit,
          showRevealEye: showRevealEye("hp"),
          showHiddenEye: showHiddenEye("hp"),
        },
        {
          key: "st",
          name: statRevealLabel("st"),
          icon: "systems/projectmoonttrpg/assets/icons/sheet/01_stagger.webp",
          amount: actorData.system.st.value,
          path: "system.attributes.st.value",
          percent: (actorData.system.st.value / actorData.system.st.max) * 100,
          editable: canEdit,
          showRevealEye: showRevealEye("st"),
          showHiddenEye: showHiddenEye("st"),
        },
        {
          key: "sp",
          name: statRevealLabel("sp"),
          icon: "systems/projectmoonttrpg/assets/icons/sheet/SanityIcons_SanityBase.webp",
          amount: actorData.system.sp.value,
          path: "system.attributes.sp.value",
          percent: (actorData.system.sp.value / actorData.system.sp.max) * 100,
          editable: canEdit,
          showRevealEye: showRevealEye("sp"),
          showHiddenEye: showHiddenEye("sp"),
        }
      ].filter((stat) => showStat(stat.key));
      const detailedStats = [
        {
          key: "actions",
          name: statRevealLabel("actions"),
          icon: "systems/projectmoonttrpg/assets/icons/sheet/Attack_Action.webp",
          amount: actorData.system.attributes.actions.value,
          path: "system.attributes.actions.value",
          max: actorData.system.attributes.actions.max,
          percent: (actorData.system.attributes.actions.value / actorData.system.attributes.actions.max) * 100,
          editable: canEdit,
          showRevealEye: showRevealEye("actions"),
          showHiddenEye: showHiddenEye("actions"),
        },
        {
          key: "reactions",
          name: statRevealLabel("reactions"),
          icon: "systems/projectmoonttrpg/assets/icons/sheet/Action_Reaction.webp",
          amount: actorData.system.attributes.reactions.value,
          path: "system.attributes.reactions.value",
          max: actorData.system.attributes.reactions.max,
          percent: (actorData.system.attributes.reactions.value / actorData.system.attributes.reactions.max) * 100,
          editable: canEdit,
          showRevealEye: showRevealEye("reactions"),
          showHiddenEye: showHiddenEye("reactions"),
        },
        {
          key: "movement",
          name: statRevealLabel("movement"),
          icon: "systems/projectmoonttrpg/assets/icons/sheet/Action_Movement.webp",
          amount: actorData.system.attributes.squares.remaining,
          max: actorData.system.attributes.squares.max,
          percent: actorData.system.attributes.squares.max
            ? (actorData.system.attributes.squares.remaining / actorData.system.attributes.squares.max) * 100
            : 0,
          editable: canEdit,
          showRevealEye: showRevealEye("movement"),
          showHiddenEye: showHiddenEye("movement"),
        },
        {
          key: "light",
          name: statRevealLabel("light"),
          icon: "systems/projectmoonttrpg/assets/icons/sheet/00_light.webp",
          path: "system.light.value",
          amount: actorData.system.light.value,
          max: actorData.system.light.max,
          percent: (actorData.system.light.value / actorData.system.light.max) * 100,
          editable: canEdit,
          showRevealEye: showRevealEye("light"),
          showHiddenEye: showHiddenEye("light"),
        }
      ].filter((stat) => showStat(stat.key));
      const showDetails = showFull
        || showStat("actions")
        || showStat("reactions")
        || showStat("movement")
        || showStat("light");
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
        showDetails,
        showInitiativeValue: showStat("initiative"),
        showInitiativeEye: showRevealEye("initiative"),
        showInitiativeHiddenEye: showHiddenEye("initiative"),
        showNameRevealEye: game.user.isGM && !revealAll && anyRevealed,
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

  /**
   * Foundry v14 delegates ContextMenu events from a shared container, so one
   * binding on `document.body` covers both the sidebar and popout tracker.
   */
  #bindCombatantContextMenu() {
    if (this.#combatantContextMenu) return;
    const ContextMenuClass = foundry.applications.ux.ContextMenu.implementation;
    this.#combatantContextMenu = new ContextMenuClass(
      document.body,
      ".ct [data-tracker-context]",
      this.#getCombatantContextOptions(),
      { jQuery: false, fixed: true, relative: "cursor" }
    );
  }

  #getCombatantContextOptions() {
    const gmCanReveal = (target) => {
      if (!game.user.isGM || isWorldTrackerRevealAll()) return false;
      return Boolean(combatantFromTrackerCard(target));
    };

    const statRevealEntries = TRACKER_REVEAL_KEYS.flatMap((key) => [
      {
        label: game.i18n.format("PMTTRPG.Combat.RevealStat", { stat: statRevealLabel(key) }),
        icon: '<i class="fas fa-eye"></i>',
        group: "visibility",
        visible: (target) => {
          if (!gmCanReveal(target) || revealKeyFromTarget(target) !== key) return false;
          return !isStatRevealed(combatantFromTrackerCard(target), key);
        },
        onClick: (_event, target) => {
          const combatant = combatantFromTrackerCard(target);
          if (!game.user.isGM || !combatant) return;
          return setStatRevealed(combatant, key, true);
        }
      },
      {
        label: game.i18n.format("PMTTRPG.Combat.HideStat", { stat: statRevealLabel(key) }),
        icon: '<i class="fas fa-eye-slash"></i>',
        group: "visibility",
        visible: (target) => {
          if (!gmCanReveal(target) || revealKeyFromTarget(target) !== key) return false;
          return isStatRevealed(combatantFromTrackerCard(target), key);
        },
        onClick: (_event, target) => {
          const combatant = combatantFromTrackerCard(target);
          if (!game.user.isGM || !combatant) return;
          return setStatRevealed(combatant, key, false);
        }
      }
    ]);

    return [
      {
        label: "PMTTRPG.Combat.PanToToken",
        icon: '<i class="fas fa-arrows-to-dot"></i>',
        group: "canvas",
        visible: (target) => canPingOrPanCombatant(combatantFromTrackerCard(target)),
        onClick: (_event, target) => {
          const token = combatantCanvasToken(combatantFromTrackerCard(target));
          if (!token || !(game.user.isGM || token.isVisible)) return;
          return canvas.animatePan({ x: token.center.x, y: token.center.y });
        }
      },
      {
        label: "PMTTRPG.Combat.PingToken",
        icon: '<i class="fas fa-bullseye"></i>',
        group: "canvas",
        visible: (target) => canPingOrPanCombatant(combatantFromTrackerCard(target)),
        onClick: (_event, target) => {
          const token = combatantCanvasToken(combatantFromTrackerCard(target));
          if (!token || !(game.user.isGM || token.isVisible)) return;
          return canvas.ping(token.center);
        }
      },
      {
        label: "PMTTRPG.Combat.RevealTracker",
        icon: '<i class="fas fa-eye"></i>',
        group: "visibility",
        visible: (target) => {
          if (!gmCanReveal(target) || revealKeyFromTarget(target) !== "all") return false;
          return !isBulkTrackerReveal(combatantFromTrackerCard(target));
        },
        onClick: (_event, target) => {
          const combatant = combatantFromTrackerCard(target);
          if (!game.user.isGM || !combatant) return;
          return setBulkTrackerReveal(combatant);
        }
      },
      {
        label: "PMTTRPG.Combat.HideTracker",
        icon: '<i class="fas fa-eye-slash"></i>',
        group: "visibility",
        visible: (target) => {
          if (!gmCanReveal(target) || revealKeyFromTarget(target) !== "all") return false;
          return isAnyStatRevealed(combatantFromTrackerCard(target));
        },
        onClick: (_event, target) => {
          const combatant = combatantFromTrackerCard(target);
          if (!game.user.isGM || !combatant) return;
          return clearTrackerReveal(combatant);
        }
      },
      ...statRevealEntries,
      {
        label: "PMTTRPG.Combat.RerollInitiative",
        icon: '<i class="fas fa-dice"></i>',
        group: "initiative",
        visible: (target) => {
          const combatant = combatantFromTrackerCard(target);
          return game.user.isGM && Boolean(combatant?.actor);
        },
        onClick: (_event, target) => {
          const combatant = combatantFromTrackerCard(target);
          const actor = combatant?.actor;
          if (!game.user.isGM || !actor) return;
          return rollInitiative(actor, { combatant });
        }
      },
      {
        label: "PMTTRPG.Combat.RemoveCombatant",
        icon: '<i class="fas fa-trash"></i>',
        group: "manage",
        visible: (target) => game.user.isGM && Boolean(combatantFromTrackerCard(target)),
        onClick: (_event, target) => {
          const combatant = combatantFromTrackerCard(target);
          if (!game.user.isGM || !combatant) return;
          return game.combat?.deleteEmbeddedDocuments("Combatant", [combatant.id]);
        }
      }
    ];
  }
}
