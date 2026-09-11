import { PMTTRPGUtility } from "../utility.js";
import { resolveActingUser } from "../acting-user.js";

const SOCKET_EVENT = "system.projectmoonttrpg";
const CHOICE_REQUEST = "eeChoiceRequest";
const CHOICE_RESPONSE = "eeChoiceResponse";
const CHOICE_TIMEOUT_MS = 120_000;

/** @type {Map<string, { resolve: (id: string|null) => void }>} */
const _pending = new Map();
let _socketRegistered = false;

/**
 * Prompt the actor's controlling user, or the local client if that's us.
 * Returns the chosen answer id, or `null` on cancel / remote timeout.
 */
export async function promptChoiceDialog({ prompt, choices, actor = null, tokenId = null } = {}) {
  const list = Array.isArray(choices) ? choices.filter((c) => c?.id && c?.label) : [];
  if (!list.length) return null;

  ensureChoiceSocket();

  const recipient = resolvePromptUser(actor, tokenId);
  if (!recipient || recipient.id === game.user.id) {
    return showLocalChoiceDialog({ prompt, choices: list });
  }

  return requestRemoteChoice({
    userId: recipient.id,
    prompt,
    choices: list,
  });
}

/**
 * Active non-GM owner of the token or actor, else the current user if they
 * can act, else an active GM.
 */
export function resolvePromptUser(actor, tokenId = null) {
  if (!actor && !tokenId) return game.user;
  return resolveActingUser(actor, tokenId) ?? game.user;
}

async function showLocalChoiceDialog({ prompt, choices }) {
  const classes = ["projectmoonttrpg", "PMTTRPG-dialog"];
  if (PMTTRPGUtility.nightmode) classes.push("nightmode");

  const title = game.i18n.localize("PMTTRPG.Dialog.easyEffectsChoiceTitle");
  const content = `<p class="ee-choice-prompt">${foundry.utils.escapeHTML(String(prompt ?? ""))}</p>`;

  const buttons = choices.map((choice, index) => ({
    action: choice.id,
    label: choice.label,
    default: index === 0,
    callback: () => choice.id,
  }));
  buttons.push({
    action: "cancel",
    label: game.i18n.localize("PMTTRPG.Dialog.cancel"),
    callback: () => null,
  });

  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes,
    content,
    buttons,
    rejectClose: false,
  });
}

function requestRemoteChoice({ userId, prompt, choices }) {
  const requestId = foundry.utils.randomID();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      _pending.delete(requestId);
      console.warn("[EasyEffects] Choice dialog timed out waiting for remote user");
      ui.notifications?.warn(game.i18n.localize("PMTTRPG.Dialog.easyEffectsChoiceTimeout"));
      resolve(null);
    }, CHOICE_TIMEOUT_MS);

    _pending.set(requestId, {
      resolve: (answerId) => {
        clearTimeout(timer);
        _pending.delete(requestId);
        resolve(answerId);
      },
    });

    game.socket.emit(SOCKET_EVENT, {
      type: CHOICE_REQUEST,
      requestId,
      userId,
      prompt,
      choices,
    });
  });
}

export function registerChoiceDialogSocket() {
  ensureChoiceSocket();
}

function ensureChoiceSocket() {
  if (_socketRegistered) return;
  if (!game?.socket) return;
  _socketRegistered = true;

  game.socket.on(SOCKET_EVENT, async (data) => {
    if (!data || typeof data !== "object") return;

    if (data.type === CHOICE_REQUEST) {
      if (data.userId !== game.user.id) return;
      const answerId = await showLocalChoiceDialog({
        prompt: data.prompt,
        choices: data.choices ?? [],
      });
      game.socket.emit(SOCKET_EVENT, {
        type: CHOICE_RESPONSE,
        requestId: data.requestId,
        answerId,
      });
      return;
    }

    if (data.type === CHOICE_RESPONSE) {
      const pending = _pending.get(data.requestId);
      if (!pending) return;
      pending.resolve(data.answerId ?? null);
    }
  });
}
