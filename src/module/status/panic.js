// ── Panic dialog ────────────────────────────────────────────────────────

const { renderTemplate } = foundry.applications.handlebars;

const TEMPLATE_RETALIATION = "systems/projectmoonttrpg/templates/dialog/panic-dialog.hbs";

/**
 * Shows the panic option dialog.
 *
 * @param {ActorPMTTRPG} actor        — the actor who is panicking
 * @returns {Promise<RetaliationChoice|null>}
 */
export async function showPanicDialog(actor) {
  // Gather equipped weapons and skills for counter/skill options.
  const equippedWeapons = actor.items
    .filter(i => i.type === "weapon" && i.system?.equipped)
    .map(i => ({ id: i.id, name: i.name, img: i.img, type: "weapon" }));

  const templateData = {
    actor,
    options: _buildRetaliationOptions(equippedWeapons, equippedOutfits, equippedSkills),
    i18n: {
      title:            game.i18n.localize("PMTTRPG.Panic.SelectPanic"),
      dontChoose:       game.i18n.localize("PMTTRPG.Panic.DontChoose"),
      confirm:          game.i18n.localize("PMTTRPG.Panic.Confirm"),
      cancel:           game.i18n.localize("PMTTRPG.Dialog.cancel"),
    },
  };

  const html = await renderTemplate(TEMPLATE_PANIC, templateData);

  return foundry.applications.api.DialogV2.wait({
    window: { title: templateData.i18n.title },
    classes: _dialogClasses(),
    content: html,
    buttons: [
      {
        action: "confirm",
        label: templateData.i18n.confirm,
        icon: "fa-solid fa-check",
        default: true,
        callback: (event, button, dialog) => _readPanicForm(dialog, actor),
      },
      {
        action: "cancel",
        label: templateData.i18n.cancel,
        icon: "fa-solid fa-xmark",
        callback: () => null,
      },
    ],
    rejectClose: false,
    render: (event, dialog) => _bindPanicDialogListeners(dialog),
  });
}