import {
  CLASH_FLAG_SCOPE,
  CLASH_FLAG_KEY,
  serialiseClashState,
  deserialiseClashState,
} from "./clash-state.js";

const { renderTemplate } = foundry.applications.handlebars;

const TEMPLATES = {
  attackCard:      "systems/projectmoonttrpg/templates/combat/clashing/attack-card.hbs",
  clashResultCard: "systems/projectmoonttrpg/templates/combat/clashing/clash-result-card.hbs",
};

// ── Card posting ──────────────────────────────────────────────────────────────

export async function postAttackCard(state, attackRoll, messageId = null) {
  const rollHtml = await attackRoll.render({ isPrivate: false });
  const content  = await renderTemplate(TEMPLATES.attackCard, {
    state, rollHtml, isGM: game.user.isGM, i18n: _attackCardI18n(state),
  });

  const chatData = {
    content,
    rolls:   [attackRoll.toJSON()],
    sound:   CONFIG.sounds.dice,
    flags: { [CLASH_FLAG_SCOPE]: { [CLASH_FLAG_KEY]: serialiseClashState(state) } },
  };

  let message;
  if (messageId) {
    message = game.messages.get(messageId);
    if (message) {
      if (message.isAuthor || game.user.isGM) {
        await message.update(chatData);
      } else {
        game.socket.emit("system.projectmoonttrpg", { message: messageId, content: chatData.content, flags: chatData.flags });
      }
      //await message.update(chatData);
    }
  } else {
    chatData.author = game.user.id;
    chatData.speaker = ChatMessage.getSpeaker({ actor: game.actors.get(state.attackerActorId) });
    message = await ChatMessage.create(chatData);
  }

  return message;
}

export async function updateAttackCard(messageId, updatedState) {
  const message = game.messages.get(messageId);
  if (!message) return;
  const rollHtml = await _rerenderRollHtml(message);
  const content  = await renderTemplate(TEMPLATES.attackCard, {
    state: updatedState, rollHtml, isGM: game.user.isGM, i18n: _attackCardI18n(updatedState),
  });

  if (message.isAuthor || game.user.isGM) {
    await message.update({
      content: content, 
      [`flags.${CLASH_FLAG_SCOPE}.${CLASH_FLAG_KEY}`]: serialiseClashState(updatedState) }
    );
  } else {
    game.socket.emit("system.projectmoonttrpg", { 
      message: messageId, 
      content: content, 
      [`flags.${CLASH_FLAG_SCOPE}.${CLASH_FLAG_KEY}`]: serialiseClashState(updatedState) }
    );
  }
}

export async function postResultCard(state, defenseRoll, messageId = null) {
  const defenseRollHtml = await defenseRoll?.render({ isPrivate: false });
  const attackerWon     = state.result === "attackWin";
  const defenderWon     = state.result === "defenseWin";
  const blockWin        = defenderWon && state.retaliationType === "block";
  const evadeWin        = defenderWon && state.retaliationType === "evade";
 
  const content = await renderTemplate(TEMPLATES.clashResultCard, {
    state, defenseRollHtml, attackerWon, defenderWon, blockWin, evadeWin,
    isGM: game.user.isGM, i18n: _resultCardI18n(state, evadeWin),
  });
 
  const chatData = {
    content,
    flags: { [CLASH_FLAG_SCOPE]: { [CLASH_FLAG_KEY]: serialiseClashState(state) } },
  };
 
  let message;
  if (messageId) {
    message = game.messages.get(messageId);
    if (message) {
      if (message.isAuthor || game.user.isGM) {
        await message.update(chatData);
      } else {
        game.socket.emit("system.projectmoonttrpg", { message: messageId, content: chatData.content, flags: chatData.flags });
      }
      //await message.update(chatData);
    }
  } else {
    chatData.author = game.user.id;
    chatData.speaker = ChatMessage.getSpeaker({ actor: game.actors.get(state.attackerActorId) });
    message = await ChatMessage.create(chatData);
  }

  console.log(state);
 
  if (game.dice3d && message) await game.dice3d.showForRoll(defenseRoll, game.user, true, null, false);
  return message;
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
  const { handleRetaliateClick } = await import("./clashing.js");

  switch (action) {
    case "clash-retaliate":  await handleRetaliateClick(state, { isIntercept: false }); break;
    case "clash-intercept":  await handleRetaliateClick(state, { isIntercept: true  }); break;
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
    using:        game.i18n.localize("PMTTRPG.Clash.Using"),
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