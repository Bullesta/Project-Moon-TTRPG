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
  rollBreakdown:   "systems/projectmoonttrpg/templates/combat/clashing/roll-breakdown.hbs",
};

// ── Card posting ──────────────────────────────────────────────────────────────

export async function postAttackCard(state, attackRoll = null, messageId = null) {
  const rollHtml = attackRoll
    ? await attackRoll.render({ isPrivate: false })
    : "";
  const content  = await renderTemplate(TEMPLATES.attackCard, {
    state, rollHtml, isGM: game.user.isGM, i18n: _attackCardI18n(state),
  });

  const chatData = {
    content,
    flags: { [CLASH_FLAG_SCOPE]: { [CLASH_FLAG_KEY]: serialiseClashState(state) } },
  };
  if (attackRoll) {
    chatData.rolls = [attackRoll.toJSON()];
    chatData.sound = CONFIG.sounds.dice;
  }

  let message;
  if (messageId) {
    message = game.messages.get(messageId);
    if (message) {
      if (message.isAuthor || game.user.isGM) {
        await message.update(chatData);
      } else {
        game.socket.emit("system.projectmoonttrpg", { message: messageId, content: chatData.content, flags: chatData.flags });
      }
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

export async function postResultCard(state, defenseRoll = null, messageId = null, attackRoll = null) {
  const defenseRollHtml = await defenseRoll?.render?.({ isPrivate: false });
  const attackerWon     = state.result === "attackWin";
  const defenderWon     = state.result === "defenseWin";
  const blockWin        = defenderWon && state.retaliationType === "block";
  const blockWinSt      = blockWin && !state.blockWinStExempt;
  const blockWinExempt  = blockWin && state.blockWinStExempt;
  const evadeWin        = defenderWon && (state.retaliationType === "evade"
    || state.retaliationType === "recycledEvade");
  const counterWin      = defenderWon && state.retaliationType === "counter";
  const counterHit      = counterWin && state.counterInRange === true;
  const counterOutOfRange = counterWin && state.counterInRange === false;

  // We (yes we) match the damage controls to the summary.
  const defaultPools = (attackerWon || counterHit)
    ? ["hp", "st"]
    : (blockWinSt || evadeWin)
      ? ["st"]
      : ["hp"];
  const poolSelect = {
    pools: defaultPools.join(","),
    pool: defaultPools[0],
    hp: defaultPools.includes("hp"),
    st: defaultPools.includes("st"),
    sp: defaultPools.includes("sp"),
  };
 
  const content = await renderTemplate(TEMPLATES.clashResultCard, {
    state, defenseRollHtml, attackerWon, defenderWon, blockWin, blockWinSt, blockWinExempt,
    evadeWin, counterWin, counterHit, counterOutOfRange, poolSelect,
    isGM: game.user.isGM, i18n: _resultCardI18n(state),
  });
 
  const chatData = {
    content,
    flags: { [CLASH_FLAG_SCOPE]: { [CLASH_FLAG_KEY]: serialiseClashState(state) } },
  };

  // Let DSN finish rolling before the result appears.
  if (game.dice3d) {
    const shows = [];
    if (attackRoll) shows.push(game.dice3d.showForRoll(attackRoll, game.user, true, null, false));
    if (defenseRoll) shows.push(game.dice3d.showForRoll(defenseRoll, game.user, true, null, false));
    if (shows.length) await Promise.all(shows);
  }
 
  let message;
  if (messageId) {
    message = game.messages.get(messageId);
    if (message) {
      if (message.isAuthor || game.user.isGM) {
        await message.update(chatData);
      } else {
        game.socket.emit("system.projectmoonttrpg", { message: messageId, content: chatData.content, flags: chatData.flags });
      }
    }
  } else {
    chatData.author = game.user.id;
    chatData.speaker = ChatMessage.getSpeaker({ actor: game.actors.get(state.attackerActorId) });
    message = await ChatMessage.create(chatData);
  }

  return message;
}

/**
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 */
export async function enhanceClashRollBreakdown(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  const state = message?.getFlag?.(CLASH_FLAG_SCOPE, CLASH_FLAG_KEY)
    ?? message?.flags?.[CLASH_FLAG_SCOPE]?.[CLASH_FLAG_KEY];
  if (!state) return;

  /** @type {{ el: Element, rows: object[]|null|undefined }[]} */
  const tips = [];

  for (const el of root.querySelectorAll('.clash-result-card__roll-total[data-clash-breakdown="attack"]')) {
    tips.push({ el, rows: state.attackRollBreakdown });
  }
  for (const el of root.querySelectorAll('.clash-result-card__roll-total[data-clash-breakdown="defense"]')) {
    tips.push({ el, rows: state.defenseRollBreakdown });
  }

  const attackRollWrap = root.querySelector('.clash-attack-card [data-clash-breakdown="attack"]');
  if (attackRollWrap) {
    const diceTotal = attackRollWrap.querySelector(".dice-total") ?? attackRollWrap;
    tips.push({ el: diceTotal, rows: state.attackRollBreakdown });
  }

  for (const { el, rows } of tips) {
    if (!el || !rows?.length) continue;
    const breakdownHtml = await renderTemplate(TEMPLATES.rollBreakdown, { rows });
    el.classList.add("clash-roll-total--hoverable");
    el.dataset.tooltipHtml = breakdownHtml;
    el.dataset.tooltipClass = "projectmoonttrpg damage-breakdown-tooltip";
    el.dataset.tooltipDirection = "UP";
    if (!el.getAttribute("aria-label")) {
      el.setAttribute("aria-label", game.i18n.localize("PMTTRPG.Clash.Breakdown.Title"));
    }
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  }
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
    challengeNotice: game.i18n.format("PMTTRPG.Clash.ChallengeNotice", {
      attacker: state.attackerName,
      target: state.targetName || game.i18n.localize("PMTTRPG.Clash.NoTarget"),
    }),
    retaliatedBy: state.retaliatorName
      ? game.i18n.format("PMTTRPG.Clash.RetaliatedBy",{ name: state.retaliatorName })
      : "",
    rollHidden:   game.i18n.localize("PMTTRPG.Clash.RollHidden"),
    resolved:     game.i18n.localize("PMTTRPG.Clash.Resolved"),
    waiting:      game.i18n.localize("PMTTRPG.Clash.WaitingForRoll"),
  };
}

function _resultCardI18n(state) {
  const dtype = state.damageType || "none";
  const dtypeKey = `PMTTRPG.DamageType${dtype.charAt(0).toUpperCase()}${dtype.slice(1)}`;
  return {
    attackWin:    game.i18n.localize("PMTTRPG.Clash.AttackWin"),
    defenseWin:   game.i18n.localize("PMTTRPG.Clash.DefenseWin"),
    evadeWin:     game.i18n.localize("PMTTRPG.Clash.EvadeWin"),
    counterWin:   game.i18n.localize("PMTTRPG.Clash.CounterWin"),
    counterOutOfRange: game.i18n.localize("PMTTRPG.Clash.CounterOutOfRange"),
    blockWinRangedExempt: game.i18n.localize("PMTTRPG.Clash.BlockWinRangedExempt"),
    margin:       game.i18n.localize("PMTTRPG.Clash.Margin"),
    hpDamage:     game.i18n.localize("PMTTRPG.Clash.HPDamage"),
    stDamage:     game.i18n.localize("PMTTRPG.Clash.STDamage"),
    stRegen:      game.i18n.localize("PMTTRPG.Clash.STRegen"),
    stDamageToAttacker:     game.i18n.localize("PMTTRPG.Clash.STDamageToAttacker"),
    takeDamage:   game.i18n.localize("PMTTRPG.Clash.TakeDamage"),
    applyRegen:   game.i18n.localize("PMTTRPG.Clash.ApplyRegen"),
    damageApplied:game.i18n.localize("PMTTRPG.Clash.DamageApplied"),
    damageType:   game.i18n.localize(dtypeKey),
  };
}