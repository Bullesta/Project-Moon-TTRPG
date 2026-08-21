import { emitTokenMoved } from "../easy-effects/registry.js";
import { registerTokenRuler } from "../canvas/token-ruler.js";

function combatantForToken(tokenDoc) {
  const combat = game.combat;
  if (!combat?.started || !tokenDoc) return null;
  const tokenId = tokenDoc.id;
  const actorId = tokenDoc.actor?.id;
  return combat.combatants.find((entry) => {
    const entryTokenId = entry.tokenId ?? entry.token?.id;
    const entryActorId = entry.actorId ?? entry.actor?.id;
    return (tokenId && entryTokenId === tokenId) || (actorId && entryActorId === actorId);
  }) ?? null;
}

export function actorCombatToken(actor) {
  if (!actor) return null;
  if (actor.token) return actor.token;
  const combat = game.combat;
  if (combat?.started) {
    const combatant = combat.combatants.find((entry) => {
      const entryActorId = entry.actorId ?? entry.actor?.id;
      return entryActorId && entryActorId === actor.id;
    });
    if (combatant?.token) return combatant.token;
  }
  return actor.getActiveTokens?.(true, true)?.[0] ?? null;
}

function paidHistory(tokenDoc) {
  const history = tokenDoc?.movementHistory;
  if (!Array.isArray(history) || !history.length) return [];
  return history.filter((waypoint) => !waypoint?.forced && !waypoint?.teleport);
}

function measureWaypointSpaces(tokenDoc, waypoints) {
  if (!Array.isArray(waypoints) || !waypoints.length) return 0;
  try {
    const measured = tokenDoc.measureMovementPath?.(waypoints)
      ?? canvas?.grid?.measurePath?.(waypoints);
    const spaces = Number(measured?.spaces);
    if (Number.isFinite(spaces) && spaces >= 0) return Math.max(0, Math.round(spaces));
    const distance = Number(measured?.distance);
    const cell = Number(canvas?.grid?.distance) || 1;
    if (Number.isFinite(distance) && distance >= 0 && cell > 0) {
      return Math.max(0, Math.round(distance / cell));
    }
  } catch (error) {
    console.warn("[PMTTRPG] measureMovementPath failed", error);
  }
  return 0;
}

function paidWaypoints(waypoints) {
  if (!Array.isArray(waypoints) || !waypoints.length) return [];
  return waypoints.filter((waypoint) => !waypoint?.forced && !waypoint?.teleport);
}

function chunkSpaceCost(tokenDoc, chunk) {
  if (!chunk) return 0;
  const measured = measureWaypointSpaces(tokenDoc, paidWaypoints(chunk.waypoints));
  if (measured > 0) return measured;
  const spaces = Number(chunk.spaces);
  if (Number.isFinite(spaces) && spaces >= 0) return Math.max(0, Math.round(spaces));
  return 0;
}

export function tokenHistorySquareCost(tokenDoc) {
  return measureWaypointSpaces(tokenDoc, paidHistory(tokenDoc));
}

export function actorHistorySquareCost(actor) {
  if (!game.combat?.started) return 0;
  return tokenHistorySquareCost(actorCombatToken(actor));
}

export function actorSquaresExhausted(actor) {
  return Boolean(game.combat?.started && actor?.getFlag("projectmoonttrpg", "squaresExhausted"));
}

export async function exhaustRemainingSquares(actor) {
  if (!actor || !game.combat?.started) return actor;
  const tokenDoc = actorCombatToken(actor);
  const combatant = combatantForToken(tokenDoc) ?? game.combat.combatants.find((entry) => {
    const entryActorId = entry.actorId ?? entry.actor?.id;
    return entryActorId && entryActorId === actor.id;
  });
  if (!combatant || game.combat.combatant?.id !== combatant.id) return actor;

  const updates = {};
  if (!actor.getFlag("projectmoonttrpg", "squaresExhausted")) {
    updates["flags.projectmoonttrpg.squaresExhausted"] = true;
  }
  const movement = actor.system.attributes?.movement;
  if (movement && (Number(movement.value) || 0) > 0) {
    updates["system.attributes.movement.value"] = 0;
  }
  if (foundry.utils.isEmpty(updates)) return actor;
  return actor.update(updates);
}

function refreshActorFromToken(tokenDoc) {
  const actor = tokenDoc?.actor;
  if (!actor) return;
  actor.prepareData();
  if (actor.sheet?.rendered) actor.sheet.render(false);
  if (game.combat && ui.combat?.rendered && combatantForToken(tokenDoc)) {
    ui.combat.render();
  }
}

function isUndoMovement(movement, operation) {
  if (String(movement?.method ?? operation?.method ?? "") === "undo") return true;
  return Boolean(operation?.undo || operation?.isUndo);
}

function isFreeMovement(movement) {
  if (!movement || movement.forced) return true;
  const waypoints = [
    ...(movement.pending?.waypoints ?? []),
    ...(movement.passed?.waypoints ?? []),
  ];
  if (!waypoints.length) return false;
  return waypoints.every((waypoint) => waypoint?.teleport || waypoint?.forced);
}

async function emitMovedIfNeeded(tokenDoc, movement, operation, user) {
  const userId = user?.id ?? user;
  if (userId && game.user.id !== userId) return;
  if (isUndoMovement(movement, operation) || isFreeMovement(movement)) return;

  const combatant = combatantForToken(tokenDoc);
  const actor = tokenDoc?.actor;
  if (!actor || !combatant || game.combat?.combatant?.id !== combatant.id) return;
  if (!actor.isOwner && !game.user.isGM) return;

  const squares = Math.max(
    chunkSpaceCost(tokenDoc, movement?.passed),
    chunkSpaceCost(tokenDoc, movement?.pending),
  );
  if (squares <= 0) return;

  try {
    await emitTokenMoved({
      actor,
      actorId: actor.id,
      token: tokenDoc,
      combat: game.combat,
      combatant,
      movement,
      moved: {
        squares,
        spaces: squares,
        movement: squares,
        forced: false,
        method: String(movement?.method ?? ""),
      },
    });
  } catch (error) {
    console.warn("[PMTTRPG] tokenMoved hook failed", error);
  }
}

function registerCombatDocument() {
  const Base = CONFIG.Combat.documentClass;

  class CombatPMTTRPG extends Base {
    /** @override */
    async _clearMovementHistoryOnStartTurn(combatant, _context) {
      if (!combatant) return;
      return combatant.clearMovementHistory();
    }
  }

  CONFIG.Combat.documentClass = CombatPMTTRPG;
}

export function registerCombatMovement() {
  registerCombatDocument();
  registerTokenRuler();

  Hooks.on("moveToken", (tokenDoc, movement, operation, user) => {
    refreshActorFromToken(tokenDoc);
    void emitMovedIfNeeded(tokenDoc, movement, operation, user);
  });

  Hooks.on("recordToken", (tokenDoc) => {
    refreshActorFromToken(tokenDoc);
  });
}
