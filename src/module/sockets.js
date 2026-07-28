/**
 * Registers the system socket listener that handles GM-routed operations.
 * All updates that require GM permissions are emitted by player clients
 * and applied here on the GM client.
 *
 * Currently handled actions:
 *   "updateChatMessage" — updates a ChatMessage document on behalf of a player
 */

import ChatMessagePMTTRPG from "./chat/chat-message-pmttrpg.js";

const SOCKET_EVENT = "system.projectmoonttrpg";

/**
 * Registers all socket handlers.
 * Should be called once on the "ready" hook so game.socket is available.
 */
export function registerSocketHandlers() {
  game.socket.on(SOCKET_EVENT, _onSocketEvent);
  console.log("[ChatSocket] Socket handlers registered.");
}

/**
 * Main socket event dispatcher. Only the GM client processes these.
 * @param {object} payload
 */
async function _onSocketEvent(payload) {
  // Only the GM handles socket-routed actions.
  if (!game.user.isGM) return;

  const { action } = payload;

  console.log(`[ChatSocket] Received socket action '${action}' from user '${payload.requesterId}'.`);

  switch (action) {
    case "updateChatMessage":
      await _handleUpdateChatMessage(payload);
      break;

    default:
      console.warn(`[ChatSocket] Unknown socket action '${action}' — ignoring.`);
  }
}

/**
 * Handles a "updateChatMessage" payload from a player client.
 *
 * @param {object} payload
 * @param {string} payload.messageId
 * @param {object} payload.updateData
 * @param {string} payload.requesterId
 */
async function _handleUpdateChatMessage({ messageId, updateData, requesterId }) {
  const requester = game.users.get(requesterId);
  const message   = game.messages.get(messageId);

  if (!message) {
    console.warn(`[ChatSocket] updateChatMessage: message '${messageId}' not found.`);
    return;
  }

  // Safety: verify the requester owns the message or is a trusted player.
  // Players can only update messages they authored.
  if (message.author?.id !== requesterId && !requester?.isGM) {
    console.warn(
      `[ChatSocket] updateChatMessage: user '${requesterId}' (${requester?.name}) ` +
      `attempted to update message '${messageId}' they don't own — rejected.`
    );
    return;
  }

  console.log(
    `[ChatSocket] Applying update from '${requester?.name ?? requesterId}' ` +
    `to message '${messageId}':`,
    updateData
  );

  await ChatMessagePMTTRPG._applyUpdate(messageId, updateData);
}