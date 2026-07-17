import { PMTTRPGUtility } from "../utility.js";
const { renderTemplate } = foundry.applications.handlebars;

export function getToolUsesRemaining(tool) {
  if (tool?.type !== "tool") return 0;
  const data = tool.system ?? {};
  if (data.form === "reusable") return Math.max(0, Number(data.usesRemaining ?? 0));
  return Math.max(0, Number(data.quantity ?? 0));
}

export function isToolUsable(tool) {
  if (tool?.type !== "tool") return false;
  const form = tool.system?.form ?? "consumable";
  if (form === "none") return !!tool.system?.allowUse;
  return form === "consumable" || form === "reusable";
}

export function toolConsumesByDefault(tool) {
  const form = tool?.system?.form ?? "consumable";
  return form === "consumable" || form === "reusable";
}

export function canUseTool(tool) {
  if (!isToolUsable(tool)) return false;
  return getToolUsesRemaining(tool) > 0;
}

export async function consumeToolUse(tool, { consume = true } = {}) {
  if (tool?.type !== "tool") return false;
  if (!consume) return true;
  if (!canUseTool(tool)) return false;

  const data = tool.system ?? {};
  if (data.form === "none") return true;
  if (data.form === "reusable") {
    const next = Math.max(0, Number(data.usesRemaining ?? 0) - 1);
    await tool.update({ "system.usesRemaining": next });
  }
  else {
    const next = Math.max(0, Number(data.quantity ?? 0) - 1);
    await tool.update({ "system.quantity": next });
  }
  return true;
}

export function getPreferredToolTargetActor() {
  const targeted = Array.from(game.user?.targets ?? []);
  return targeted[0]?.actor ?? null;
}

export async function useTool(tool, {
  consume,
  configureDialog = true,
  target = undefined,
} = {}) {
  if (tool?.type !== "tool") return false;

  if (tool.system?.toolKind === "applied") {
    return false;
  }

  if (tool.system?.toolKind === "standalone") {
    const { useStandaloneTool } = await import("./standalone-tool.js");
    return useStandaloneTool(tool, { configureDialog, target });
  }

  const actor = tool.actor;
  if (!actor) {
    ui.notifications.warn(game.i18n.localize("PMTTRPG.Dialog.toolNeedsActor"));
    return false;
  }

  if (!canUseTool(tool)) {
    ui.notifications.warn(game.i18n.localize("PMTTRPG.Dialog.noToolUses"));
    return false;
  }

  let willConsume = consume ?? toolConsumesByDefault(tool);
  let resolvedTarget = target;

  if (configureDialog) {
    const result = await promptToolUseDialog(tool, { consume: willConsume });
    if (result === null) return null;
    willConsume = result.consume;

    if (result.promptTarget) {
      const targeting = game.projectmoonttrpg?.targeting;
      if (!targeting) {
        ui.notifications.warn(game.i18n.localize("PMTTRPG.Dialog.noToolTargeting"));
        return false;
      }
      const chosen = await targeting.promptTargetSelection({
        actor,
        title: tool.name,
        sourceName: tool.name,
        sourceImg: tool.img,
        preferredCombatantId: game.combat?.combatant?.id ?? null,
      });
      if (chosen === null) return null;
      resolvedTarget = chosen?.actor ?? null;
    }
    else if (resolvedTarget === undefined) {
      resolvedTarget = getPreferredToolTargetActor();
    }
  }
  else if (resolvedTarget === undefined) {
    resolvedTarget = getPreferredToolTargetActor();
  }

  if (willConsume) {
    const ok = await consumeToolUse(tool, { consume: true });
    if (!ok) {
      ui.notifications.warn(game.i18n.localize("PMTTRPG.Dialog.noToolUses"));
      return false;
    }
  }

  const remaining = getToolUsesRemaining(tool);
  const formKey = {
    reusable: "PMTTRPG.ToolFormReusable",
    none: "PMTTRPG.ToolFormNone",
  }[tool.system?.form] ?? "PMTTRPG.ToolFormConsumable";
  const formLabel = game.i18n.localize(formKey);

  const templateData = {
    actor,
    image: tool.img,
    title: tool.name,
    flavor: game.i18n.format("PMTTRPG.Chat.toolUsedFlavor", {
      form: formLabel,
      remaining,
    }),
    details: tool.system?.description ?? "",
    rollType: "tool",
    toolKind: tool.system?.toolKind ?? "market",
    target: resolvedTarget ? {
      actorId: resolvedTarget.id,
      name: resolvedTarget.name,
      img: resolvedTarget.img,
    } : null,
  };

  const chatData = {
    author: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: await renderTemplate("systems/projectmoonttrpg/templates/chat/chat-move.html", templateData),
    flags: {
      projectmoonttrpg: {
        toolUse: {
          itemId: tool.id,
          actorId: actor.id,
          targetActorId: resolvedTarget?.id ?? null,
        },
      },
    },
  };

  let rollMode = "publicroll";
  switch (game.release.generation) {
  case 13:
    rollMode = game.settings.get("core", "rollMode");
    break;
  default:
    rollMode = game.settings.get("core", "messageMode");
    break;
  }

  if (["gm", "blind"].includes(rollMode)) chatData.whisper = ChatMessage.getWhisperRecipients("GM");
  if (rollMode === "self") chatData.whisper = [game.user.id];
  if (rollMode === "blind") chatData.blind = true;

  const message = await ChatMessage.create(chatData);

  Hooks.callAll("pmttrpg.toolUsed", {
    actor,
    item: tool,
    target: resolvedTarget ?? null,
  });
  Hooks.callAll("pmttrpg.actorAction", {
    actor,
    item: tool,
    actionType: "tool",
    target: resolvedTarget ?? null,
  });

  return message;
}

async function promptToolUseDialog(tool, { consume = true } = {}) {
  const remaining = getToolUsesRemaining(tool);
  const form = tool.system?.form ?? "consumable";
  const dialogData = {
    tool: {
      name: tool.name,
      img: tool.img,
      remaining,
      form,
    },
    consume,
    showConsume: form !== "none",
    inCombat: !!game.combat,
  };

  const html = await renderTemplate(
    "systems/projectmoonttrpg/templates/dialog/tool-use-dialog.html",
    dialogData
  );

  const dlgOptions = { classes: ["projectmoonttrpg", "PMTTRPG-dialog"] };
  if (PMTTRPGUtility.nightmode) dlgOptions.classes.push("nightmode");

  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.format("PMTTRPG.Dialog.useToolTitle", { name: tool.name }) },
    classes: dlgOptions.classes,
    content: html,
    buttons: [{
      action: "use",
      label: game.i18n.localize("PMTTRPG.Dialog.useTool"),
      default: true,
      callback: (event, button, dialog) => {
        const form = dialog.element.querySelector("form");
        return {
          consume: !!form.consumeUse?.checked,
          promptTarget: !!form.promptTarget?.checked,
        };
      },
    }, {
      action: "cancel",
      label: game.i18n.localize("PMTTRPG.Dialog.cancel"),
      callback: () => null,
    }],
    rejectClose: false,
  });
}
