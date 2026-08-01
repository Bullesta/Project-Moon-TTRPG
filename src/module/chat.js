import {
  DAMAGE_POOLS,
  DAMAGE_TYPES,
  enhanceDamageTakenCard,
  getActorWeaponDamageType,
} from "./damage-application.js";

export const displayChatActionButtons = function(message, html, data) {
  html = $(html);
  const chatCard = html.find(".PMTTRPG.chat-card");

  // Hide damage buttons if necessary.
  if (!game.user.isGM || !game.settings.get('projectmoonttrpg', 'enableDamageButtons')) {
    html.find('.chat-damage-buttons').hide();
  }

  // Sync damage type from flags if the card did not include one.
  const flaggedType = message?.flags?.projectmoonttrpg?.damageType;
  html.find(".chat-damage-buttons").each((_, el) => {
    if (!el.dataset.damageType && DAMAGE_TYPES.includes(flaggedType)) {
      el.dataset.damageType = flaggedType;
      el.querySelectorAll("button.dtype").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.damageType === flaggedType);
      });
    }
  });

  const appliedDamage = message?.flags?.projectmoonttrpg?.appliedDamage;
  if (appliedDamage) {
    const actor = fromUuidSync(appliedDamage.uuid);
    const canRevert = game.user.isGM || actor?.isOwner;
    if (appliedDamage.isReverted || !canRevert || !appliedDamage.updates?.length) {
      html.find('button[data-action="revert-damage"]').remove();
    }
    enhanceDamageTakenCard(message, html[0] ?? html);
  }

  if ( chatCard.length > 0 ) {
    // If the user is the message author or the actor owner, proceed.
    let actor = game.actors.get(data.message.speaker.actor);
    // Exit early from further operations if this is a GM user.
    if ( game.user.isGM ) return;
    if ((data.author.id === game.user.id) || ( actor && actor.isOwner )) return;
    // Otherwise conceal action buttons.
    chatCard.find("button[data-action], .button-disabled").each((i, btn) => {
      btn.style.display = "none"
    });
  }
}

export const activateChatListeners = function(html) {
  html = $(html);
  html.on('click', 'button[data-action]', (event) => _onChatCardAction(event));
}

function _onChatCardAction(event) {
  event.preventDefault();

  // Extract card data
  const button = event.currentTarget;
  const card = button.closest(".chat-card");
  const messageId = button.closest(".message").dataset.messageId;
  const message =  game.messages.get(messageId);
  const action = button.dataset.action;

  if (action === "set-pool") {
    _chatActionSetPool(button, event);
    return;
  }
  if (action === "set-damage-type") {
    _chatActionSetDamageType(button);
    return;
  }

  // Perform the action.
  if (action == 'xp') {
    // Recover the actor for the chat card
    const actor = card ? _getChatCardActor(card) : null;
    if ( !actor ) return;

    button.disabled = true;
    _chatActionMarkXp(actor, message);
  }

  if (action === "revert-damage") {
    _chatActionRevertDamage(message, button);
    return;
  }

  // Validate permission to proceed with the roll
  if ( !( game.user.isGM ) ) return;

  // Chat damage.
  if (action.includes('damage') || action == 'heal') _chatActionDamage(message, action, button);
}

/**
 * Get the Actor which is the author of a chat card
 * @param {HTMLElement} card    The chat card being used
 * @return {Actor|null}         The Actor entity or null
 * @private
 */
function _getChatCardActor(card) {

  // Case 1 - a synthetic actor from a Token
  const tokenKey = card.dataset.tokenId;
  if (tokenKey) {
    const [sceneId, tokenId] = tokenKey.split(".");
    const scene = game.scenes.get(sceneId);
    if (!scene) return null;
    const tokenDoc = scene.tokens.get(tokenId);
    if (!tokenDoc) return null;
    return tokenDoc.actor;
  }

  // Case 2 - use Actor ID directory
  const actorId = card.dataset.actorId;
  return game.actors.get(actorId) || null;
}

function _readSelectedPools(root) {
  const raw = root?.dataset?.pools || root?.dataset?.pool || "hp";
  const pools = String(raw).split(",").map((p) => p.trim()).filter((p) => DAMAGE_POOLS.includes(p));
  return pools.length ? DAMAGE_POOLS.filter((p) => pools.includes(p)) : ["hp"];
}

function _writeSelectedPools(root, pools) {
  const ordered = DAMAGE_POOLS.filter((p) => pools.includes(p));
  const next = ordered.length ? ordered : ["hp"];
  root.dataset.pools = next.join(",");
  root.dataset.pool = next[0];
  root.querySelectorAll("button.pool").forEach((btn) => {
    btn.classList.toggle("active", next.includes(btn.dataset.pool));
  });
}

function _chatActionSetPool(button, event) {
  const root = button.closest(".chat-damage-buttons");
  if (!root) return;
  const pool = button.dataset.pool;
  if (!DAMAGE_POOLS.includes(pool)) return;

  let pools = _readSelectedPools(root);
  if (event?.shiftKey) {
    if (pools.includes(pool)) {
      if (pools.length > 1) pools = pools.filter((p) => p !== pool);
    } else {
      pools = [...pools, pool];
    }
  } else {
    pools = [pool];
  }
  _writeSelectedPools(root, pools);
}

function _chatActionSetDamageType(button) {
  const root = button.closest(".chat-damage-buttons");
  if (!root) return;
  const damageType = button.dataset.damageType;
  if (!DAMAGE_TYPES.includes(damageType)) return;
  root.dataset.damageType = damageType;
  root.querySelectorAll("button.dtype").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.damageType === damageType);
  });
}

async function _chatActionMarkXp(actor, message) {
  if (!actor.system || !actor.system.attributes.xp) return;

  let xp = actor.system.attributes.xp.value ?? 0;
  let updates = {
    'system.attributes.xp.value': Number(xp) + 1
  };

  // Update the actor.
  await actor.update(updates);

  // Update the chat message.
  let $content = $(message.content);
  let $button = $content.find('.xp-button');

  // Replace the button.
  let newButton = `<span class="xp-button button button-disabled">${game.i18n.localize("PMTTRPG.XpMarked")} <i class="fas fa-check"></i></span>`;
  $button.replaceWith($(newButton));

  if (message.isAuthor || game.user.isGM) {
    await message.update({'content': $content[0].outerHTML});
  }
  else {
    game.socket.emit('system.projectmoonttrpg', {
      message: message.id,
      content: $content[0].outerHTML
    });
  }
}

function _resolveDamageType(message, root) {
  const fromCard = root?.dataset?.damageType;
  if (DAMAGE_TYPES.includes(fromCard)) return fromCard;

  const fromFlag = message?.flags?.projectmoonttrpg?.damageType;
  if (DAMAGE_TYPES.includes(fromFlag)) return fromFlag;

  const speakerActor = ChatMessage.getSpeakerActor?.(message.speaker)
    ?? game.actors.get(message?.speaker?.actor);
  return getActorWeaponDamageType(speakerActor);
}

async function _chatActionDamage(message, action, button) {
  let actors = canvas.tokens.controlled.map(t => t.document.actor).filter(Boolean);
  if (!actors.length) return;

  const root = button?.closest?.(".chat-damage-buttons");
  const pools = _readSelectedPools(root);
  const damageType = _resolveDamageType(message, root);
  const rollTotal = Number($(message.content).find('.dice-total')?.first()?.text()?.trim()) || 0;
  const attacker = ChatMessage.getSpeakerActor?.(message.speaker) ?? game.actors.get(message?.speaker?.actor) ?? null;

  const opByAction = {
    damage: "full",
    "half-damage": "half",
    "double-damage": "double",
    heal: "heal",
  };
  const op = opByAction[action];
  if (!op) return;

  for (const actor of actors) {
    await actor.applyDamage(rollTotal, {
      pool: pools.length === 1 ? pools[0] : pools,
      op,
      damageType,
      attacker: op === "heal" ? null : attacker,
      sourceLabel: message.speaker?.alias ?? attacker?.name ?? null,
    });
  }
}

async function _chatActionRevertDamage(message, button) {
  const appliedDamage = message?.flags?.projectmoonttrpg?.appliedDamage;
  if (!appliedDamage || appliedDamage.isReverted) return;

  const actor = fromUuidSync(appliedDamage.uuid);
  if (!(actor instanceof Actor)) return;
  if (!(game.user.isGM || actor.isOwner)) return;

  await actor.undoDamage(appliedDamage);

  const notifyKey = appliedDamage.isHealing
    ? "PMTTRPG.DamageTaken.RevertHealNotify"
    : "PMTTRPG.DamageTaken.RevertNotify";
  ui.notifications.info(game.i18n.format(notifyKey, { name: actor.name }));

  const messageEl = button.closest(".message");
  messageEl?.querySelector(".damage-taken")?.classList.add("reverted");
  messageEl?.querySelector(".statements")?.classList.add("reverted");
  button.remove();

  const contentEl = messageEl?.querySelector(".message-content");
  await message.update({
    "flags.projectmoonttrpg.appliedDamage.isReverted": true,
    content: contentEl?.innerHTML ?? message.content,
  });
}
