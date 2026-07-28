import {
  CLASH_FLAG_SCOPE,
  CLASH_FLAG_KEY,
  serialiseClashState,
  deserialiseClashState,
} from "./clash-state.js";

import ChatMessagePMTTRPG, {VISIBILITY} from "../chat/chat-message-pmttrpg.js";

const { renderTemplate } = foundry.applications.handlebars;

const TEMPLATES = {
  attackCard:      "systems/projectmoonttrpg/templates/combat/clashing/attack-card.hbs",
  clashResultCard: "systems/projectmoonttrpg/templates/combat/clashing/clash-result-card.hbs",
};

export function registerClashRenderer() {
  ChatMessagePMTTRPG.registerRenderer(CLASH_FLAG_KEY, _clashRenderer);
}

/**
 * Called by ChatMessagePMTTRPG.renderHTML() whenever a message with
 * a clashState flag is rendered. Replaces .message-content with the
 * appropriate clash card template.
 *
 * @param {ChatMessagePMTTRPG} message
 * @param {HTMLElement} html
 * @param {object} pmFlags
 */
async function _clashRenderer(message, html, pmFlags) {
  const raw = pmFlags[CLASH_FLAG_KEY];
  if (!raw) return;
 
  const state = deserialiseClashState(raw);
  const isAttackCard  = !state.resultMessageId || state.attackMessageId === message.id;
  const isResultCard  = state.resultMessageId  === message.id;
 
  let content;
 
  if (isResultCard) {
    const canSeeAttackRoll  = canCurrentUserSeeAttackRoll(state.attackerActorId);
    const canSeeDefenseRoll = canCurrentUserSeeDefenseRoll(state.retaliatorActorId);
    const attackerWon       = state.result === "attackWin";
    const defenderWon       = state.result === "defenseWin";
    const evadeWin          = defenderWon && state.retaliationType === "evade";
 
    // Reconstruct defense roll HTML from stored terms.
    const defenseRollHtml = await _rerenderRollHtmlFromTerms(state.defenseRollTerms);
 
    content = await renderTemplate(TEMPLATES.clashResultCard, {
      state,
      defenseRollHtml,
      attackerWon,
      defenderWon,
      evadeWin,
      canSeeAttackRoll,
      canSeeDefenseRoll,
      i18n: _resultCardI18n(state, evadeWin),
    });
 
  } else if (isAttackCard) {
    // Reconstruct attack roll HTML from stored terms.
    const rollHtml   = await _rerenderRollHtmlFromTerms(state.attackRollTerms);
    const canSeeRoll = canCurrentUserSeeAttackRoll(state.attackerActorId);
 
    content = await renderTemplate(TEMPLATES.attackCard, {
      state,
      rollHtml,
      canSeeRoll,
      i18n: _attackCardI18n(state),
    });
  }
 
  if (!content) return;
 
  const messageContent = html.querySelector(".message-content");
  if (messageContent) messageContent.innerHTML = content;
}

// ── Card posting ──────────────────────────────────────────────────────────────

/**
 * Creates the initial attack chat card.
 * Creates a placeholder first so the message ID is known, then updates
 * it with the full flags and rendered content.
 *
 * @param {ClashStateData} state     — must have attackMessageId set
 * @param {Roll} attackRoll
 * @param {string} messageId         — the placeholder message ID
 * @returns {Promise<ChatMessage>}
 */
export async function postAttackCard(state, attackRoll, messageId = null) {
  const flagUpdate = {
    content: "<!-- clash attack card -->",
    rolls: [attackRoll.toJSON()],
    sound: CONFIG.sounds.dice,
    [`flags.${CLASH_FLAG_SCOPE}.${CLASH_FLAG_KEY}`]: serialiseClashState(state),
    [`flags.${CLASH_FLAG_SCOPE}.visibility`]: VISIBILITY.PUBLIC
  }

  const message = game.messages.get(messageId);
  if(message) await message.update(flagUpdate);

  return message;
}

/**
 * Updates the attack card state (phase, retaliator, etc.).
 * Only touches flags — rendering is handled by _clashRenderer on next render.
 *
 * @param {string} messageId
 * @param {ClashStateData} updatedState
 */
export async function updateAttackCard(messageId, updatedState) {
  await ChatMessagePMTTRPG.updateViaSocket(messageId, {
    [`flags.${CLASH_FLAG_SCOPE}.${CLASH_FLAG_KEY}`]: serialiseClashState(updatedState),
  });
}

/**
 * Creates the clash result card.
 * Uses the same placeholder pattern as postAttackCard.
 *
 * @param {ClashStateData} state     — must have resultMessageId set
 * @param {Roll} defenseRoll
 * @param {string} messageId         — the placeholder message ID
 * @returns {Promise<ChatMessage>}
 */
export async function postResultCard(state, defenseRoll, messageId) {
  const flagUpdate = {
    content: "<!-- clash result card -->",
    [`flags.${CLASH_FLAG_SCOPE}.${CLASH_FLAG_KEY}`]: serialiseClashState(state),
    [`flags.${CLASH_FLAG_SCOPE}.visibility`]: VISIBILITY.PUBLIC,
  };
 
  const message = game.messages.get(messageId);
  if (message) await message.update(flagUpdate);
 
  return message;
}

/**
 * Updates the result card state (e.g. marking it as closed after damage is taken).
 * Only touches flags.
 *
 * @param {string} messageId
 * @param {ClashStateData} updatedState
 */
export async function updateResultCard(messageId, updatedState) {
  await ChatMessagePMTTRPG.updateViaSocket(messageId, {
    [`flags.${CLASH_FLAG_SCOPE}.${CLASH_FLAG_KEY}`]: serialiseClashState(updatedState),
  });
}

// ── Button click wiring ───────────────────────────────────────────────────────

export function registerClashChatListeners() {
  Hooks.once("ready", () => {
    const target = document.getElementById("chat-log") ?? document.body;
    target.addEventListener("click", _clashButtonHandler, { capture: false });
  });
}

async function _clashButtonHandler(event) {
  console.log(event);

  const button = event.target.closest("[data-action^='clash-']");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();

  const action    = button.dataset.action;
  const messageId = button.dataset.messageId;
  if (!messageId) return;

  const message = game.messages.get(messageId);
  if (!message) return;

  const raw = message.getFlag(CLASH_FLAG_SCOPE, CLASH_FLAG_KEY);
  if (!raw) return;

  const state = deserialiseClashState(raw);
  const { handleRetaliateClick, handleTakeDamageClick } = await import("./clashing.js");

  switch (action) {
    case "clash-retaliate":  await handleRetaliateClick(state, { isIntercept: false }); break;
    case "clash-intercept":  await handleRetaliateClick(state, { isIntercept: true  }); break;
    case "clash-take-damage": await handleTakeDamageClick(state, messageId);            break;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getClashStateFromMessage(messageId) {
  const message = game.messages.get(messageId);
  if (!message) return null;
  const raw = message.getFlag(CLASH_FLAG_SCOPE, CLASH_FLAG_KEY);
  return raw ? deserialiseClashState(raw) : null;
}

async function _rerenderRollHtml(message) {
  const rollJson = message.rolls?.[0];
  if (!rollJson) return "";
  try { return await Roll.fromData(rollJson).render({ isPrivate: false }); }
  catch { return ""; }
}

function _attackCardI18n(state) {
  return {
    retaliate:    game.i18n.localize("PMTTRPG.Clash.Retaliate"),
    intercept:    game.i18n.localize("PMTTRPG.Clash.Intercept"),
    attackBy:     game.i18n.format("PMTTRPG.Clash.AttackBy",     { name: state.attackerName }),
    targeting:    state.targetName
      ? game.i18n.format("PMTTRPG.Clash.Targeting",   { name: state.targetName })
      : game.i18n.localize("PMTTRPG.Clash.NoTarget"),
    retaliatedBy: state.retaliatorName
      ? game.i18n.format("PMTTRPG.Clash.RetaliatedBy",{ name: state.retaliatorName })
      : "",
    rollHidden:   game.i18n.localize("PMTTRPG.Clash.RollHidden"),
    resolved:     game.i18n.localize("PMTTRPG.Clash.Resolved"),
    waiting:      game.i18n.localize("PMTTRPG.Clash.WaitingForRoll"),
  };
}

function _resultCardI18n(state, evadeWin) {
  return {
    attackWin:    game.i18n.localize("PMTTRPG.Clash.AttackWin"),
    defenseWin:   game.i18n.localize("PMTTRPG.Clash.DefenseWin"),
    evadeWin:     game.i18n.localize("PMTTRPG.Clash.EvadeWin"),
    margin:       game.i18n.localize("PMTTRPG.Clash.Margin"),
    hpDamage:     game.i18n.localize("PMTTRPG.Clash.HPDamage"),
    stDamage:     game.i18n.localize("PMTTRPG.Clash.STDamage"),
    stRegen:      game.i18n.localize("PMTTRPG.Clash.STRegen"),
    stDamageToAttacker:     game.i18n.localize("PMTTRPG.Clash.STDamageToAttacker"),
    takeDamage:   game.i18n.localize("PMTTRPG.Clash.TakeDamage"),
    applyRegen:   game.i18n.localize("PMTTRPG.Clash.ApplyRegen"),
    damageApplied:game.i18n.localize("PMTTRPG.Clash.DamageApplied"),
    damageType:   game.i18n.localize(`PMTTRPG.DamageType${state.damageType}`),
  };
}