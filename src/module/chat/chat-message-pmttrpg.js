/**
 * ChatMessagePMTTRPG extends Foundry's ChatMessage with:
 *   1. Visibility modes — controls who sees a message's content.
 *   2. Socket-routed updates — all message mutations go through the GM
 *      to avoid permission errors on player clients.
 *   3. A renderer registry — any subsystem (clash, status macros, etc.)
 *      can register a renderHTML hook that runs after base rendering.
 *
 * ── Visibility modes ─────────────────────────────────────────────────────────
 *
 *   PUBLIC           — everyone sees full content (default)
 *   SENDER_GM        — full content to sender + GM; others see a redacted card
 *   GM_ONLY          — full content to GM only; others see nothing (or a stub)
 *   TARGET_SENDER_GM — full content to sender, GM, and the designated target actor's owners
 *   CUSTOM           — arbitrary user ID list stored in flags
 *
 * Store visibility in flags:
 *   flags.projectmoonttrpg.visibility  → one of the VISIBILITY constant values
 *   flags.projectmoonttrpg.targetActorId → required for TARGET_SENDER_GM
 *   flags.projectmoonttrpg.visibleTo   → string[] of user IDs for CUSTOM
 *
 * ── Socket-routed updates ─────────────────────────────────────────────────────
 *
 *   ChatMessagePMTTRPG.updateViaSocket(messageId, updateData)
 *
 *   If the current user is the GM, applies directly.
 *   Otherwise, emits a socket event that the GM client picks up and applies.
 *   Registered in chat-socket.js.
 *
 * ── Renderer registry ─────────────────────────────────────────────────────────
 *
 *   ChatMessagePMTTRPG.registerRenderer(flagKey, rendererFn)
 *
 *   rendererFn(message, html, flags) is called during renderHTML when the
 *   message has flags.projectmoonttrpg[flagKey] set.
 *   The renderer may mutate the html element in place.
 */

export const VISIBILITY = Object.freeze({
  PUBLIC:           "public",
  SENDER_GM:        "senderGM",
  GM_ONLY:          "gmOnly",
  TARGET_SENDER_GM: "targetSenderGM",
  CUSTOM:           "custom",
});

const FLAG_SCOPE = "projectmoonttrpg";
const SOCKET_EVENT = "system.projectmoonttrpg";

/** @type {Map<string, (message: ChatMessagePMTTRPG, html: HTMLElement, flags: object) => void>} */
const _rendererRegistry = new Map();

export default class ChatMessagePMTTRPG extends ChatMessage {

  // ── Renderer registry ───────────────────────────────────────────────────────

  /**
   * Register a renderer for messages that carry a specific flag key.
   * The renderer is called in renderHTML after base rendering and visibility
   * filtering, and may mutate the html element in place.
   *
   * @param {string} flagKey         — e.g. "clashState"
   * @param {Function} rendererFn    — (message, html, pmFlags) => void
   */
  static registerRenderer(flagKey, rendererFn) {
    _rendererRegistry.set(flagKey, rendererFn);
  }

  // ── renderHTML ──────────────────────────────────────────────────────────────

  /** @inheritDoc */
  async renderHTML(options = {}) {
    const html = await super.renderHTML(options);
    const pmFlags = this.getFlag(FLAG_SCOPE, "") ?? {};

    // 1. Apply visibility filtering.
    this._applyVisibility(html, pmFlags);

    // 2. Dispatch to registered renderers.
    for (const [flagKey, rendererFn] of _rendererRegistry) {
      if (pmFlags[flagKey] !== undefined && pmFlags[flagKey] !== null) {
        try {
          await rendererFn(this, html, pmFlags);
        } catch (err) {
          console.error(`[ChatMessagePMTTRPG] Renderer for '${flagKey}' failed:`, err);
        }
      }
    }

    return html;
  }

  // ── Visibility filtering ────────────────────────────────────────────────────

  /**
   * Mutates the rendered html element based on the message's visibility mode.
   * Hides content from users who shouldn't see it, and replaces it with
   * a redacted stub where appropriate.
   *
   * @param {HTMLElement} html
   * @param {object} pmFlags
   */
  _applyVisibility(html, pmFlags) {
    const visibility = pmFlags.visibility ?? VISIBILITY.PUBLIC;
    if (visibility === VISIBILITY.PUBLIC) return; // nothing to do

    const canSee = this._currentUserCanSee(visibility, pmFlags);
    if (canSee) return; // user has full access

    // User cannot see the content — replace with a redacted stub.
    const messageContent = html.querySelector(".message-content");
    if (!messageContent) return;

    switch (visibility) {
      case VISIBILITY.GM_ONLY:
        // Complete replacement: player sees nothing.
        messageContent.innerHTML = `
          <div class="pmttrpg-redacted pmttrpg-redacted--hidden">
            <i class="fa-solid fa-eye-slash"></i>
            <span>${game.i18n.localize("PMTTRPG.Chat.GMOnly")}</span>
          </div>`;
        break;

      case VISIBILITY.SENDER_GM:
      case VISIBILITY.TARGET_SENDER_GM:
      case VISIBILITY.CUSTOM:
        // Partial replacement: player sees a stub indicating a private message exists.
        messageContent.innerHTML = `
          <div class="pmttrpg-redacted pmttrpg-redacted--private">
            <i class="fa-solid fa-lock"></i>
            <span>${game.i18n.localize("PMTTRPG.Chat.PrivateMessage")}</span>
          </div>`;
        break;
    }
  }

  /**
   * Returns true if the current user should see the full message content.
   *
   * @param {string} visibility
   * @param {object} pmFlags
   * @returns {boolean}
   */
  _currentUserCanSee(visibility, pmFlags) {
    if (game.user.isGM) return true;

    const currentUserId = game.user.id;
    const senderId      = this.author?.id ?? null;

    switch (visibility) {
      case VISIBILITY.PUBLIC:
        return true;

      case VISIBILITY.SENDER_GM:
        return currentUserId === senderId;

      case VISIBILITY.GM_ONLY:
        return false; // GM check already returned true above

      case VISIBILITY.TARGET_SENDER_GM: {
        if (currentUserId === senderId) return true;
        const targetActorId = pmFlags.targetActorId ?? null;
        if (!targetActorId) return false;
        const targetActor = game.actors.get(targetActorId);
        return targetActor?.isOwner ?? false;
      }

      case VISIBILITY.CUSTOM: {
        const visibleTo = pmFlags.visibleTo ?? [];
        return visibleTo.includes(currentUserId);
      }

      default:
        return true;
    }
  }

  // ── Socket-routed updates ───────────────────────────────────────────────────

  /**
   * Updates a chat message safely, routing through the GM if the current
   * user doesn't have permission to update messages directly.
   *
   * GMs apply directly. Players emit a socket event.
   *
   * @param {string} messageId
   * @param {object} updateData   — plain update object, e.g. { content, flags }
   * @returns {Promise<void>}
   */
  static async updateViaSocket(messageId, updateData) {
    if (game.user.isGM) {
      await ChatMessagePMTTRPG._applyUpdate(messageId, updateData);
      return;
    }

    // Player: emit socket event for GM to apply.
    game.socket.emit(SOCKET_EVENT, {
      action: "updateChatMessage",
      messageId,
      updateData,
      requesterId: game.user.id,
    });
  }

  /**
   * Applies an update to a chat message document.
   * Called on the GM client — either directly or via socket.
   *
   * @param {string} messageId
   * @param {object} updateData
   * @returns {Promise<void>}
   */
  static async _applyUpdate(messageId, updateData) {
    const message = game.messages.get(messageId);
    if (!message) {
      console.warn(`[ChatMessagePMTTRPG] updateViaSocket: message '${messageId}' not found.`);
      return;
    }

    console.log(
      `[ChatMessagePMTTRPG] Applying socket update to message '${messageId}':`,
      updateData
    );

    await message.update(updateData);
  }

  // ── Convenience flag setters ────────────────────────────────────────────────

  /**
   * Sets the visibility mode on this message via socket.
   *
   * @param {string} visibility          — one of VISIBILITY constants
   * @param {object} [options]
   * @param {string} [options.targetActorId]  — required for TARGET_SENDER_GM
   * @param {string[]} [options.visibleTo]    — required for CUSTOM
   * @returns {Promise<void>}
   */
  async setVisibility(visibility, { targetActorId = null, visibleTo = [] } = {}) {
    const flagUpdate = {
      [`flags.${FLAG_SCOPE}.visibility`]: visibility,
    };
    if (targetActorId) flagUpdate[`flags.${FLAG_SCOPE}.targetActorId`] = targetActorId;
    if (visibleTo.length) flagUpdate[`flags.${FLAG_SCOPE}.visibleTo`]  = visibleTo;

    await ChatMessagePMTTRPG.updateViaSocket(this.id, flagUpdate);
  }
}