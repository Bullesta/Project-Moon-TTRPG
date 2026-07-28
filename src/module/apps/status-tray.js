import { groupStatuses, onStatusItemChange } from "../status/group-statuses.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { TextEditor } = foundry.applications.ux;

export class StatusTray extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "pmttrpg-status-tray",
    classes: ["pmttrpg-status-tray"],
    tag: "aside",
    window: { frame: false, positioned: false },
    actions: {
      adjustStatus: {
        handler: this.#onAdjustStatus,
        buttons: [0, 2],
      },
    },
  };

  static PARTS = {
    main: {
      template: "systems/projectmoonttrpg/templates/apps/status-tray.hbs",
    },
  };

  refresh = foundry.utils.debounce(() => this.render({ force: true }), 80);

  get actor() {
    const token = canvas.tokens?.controlled[0];
    if (token) return token.actor ?? null;
    return game.user.isGM ? null : (game.user.character ?? null);
  }

  async _prepareContext(_options) {
    const actor = this.actor;
    const enabled = game.settings.get("projectmoonttrpg", "showStatusTray");
    if (!enabled || !actor?.testUserPermission(game.user, "OBSERVER")) {
      return { statuses: [] };
    }
    return { statuses: await this.#groupStatuses(actor) };
  }

  async _onRender(context, _options) {
    await super._onRender(context, _options);
    const el = this.element;
    if (!el) return;
    document.getElementById("ui-right-column-1")?.appendChild(el);
    el.hidden = context.statuses.length === 0;

    if (!el.dataset.pmContextBound) {
      el.dataset.pmContextBound = "true";
      el.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    for (const itemEl of el.querySelectorAll("[data-status-name]")) {
      const status = context.statuses.find((s) => s.name === itemEl.dataset.statusName);
      if (status?.tooltipHtml) itemEl.dataset.tooltip = status.tooltipHtml;
    }
  }

  async close(options = {}) {
    if (options.closeKey) return this;
    return super.close(options);
  }

  async #groupStatuses(actor) {
    const statuses = groupStatuses(actor, { sort: "applied" });
    for (const status of statuses) {
      const body = status.description
        ? await TextEditor.enrichHTML(status.description, {
          async: true,
          secrets: false,
          relativeTo: actor,
        })
        : `<p class="notes">${game.i18n.localize("PMTTRPG.StatusTrayNoDescription")}</p>`;
      const countHtml = status.showCount
        ? `<span>×${status.count}</span>`
        : "";
      status.tooltipHtml = `
        <section class="pmttrpg-status-tip__inner">
          <header><strong>${foundry.utils.escapeHTML(status.name)}</strong>${countHtml}</header>
          <div class="pmttrpg-status-tip__body">${body}</div>
          <footer class="pmttrpg-status-tip__controls">${game.i18n.localize("PMTTRPG.StatusTrayControls")}</footer>
        </section>`;
    }
    return statuses;
  }

  static async #onAdjustStatus(event, el) {
    const actor = this.actor;
    const name = el.dataset.statusName;
    if (!actor?.isOwner || !name) return;

    if (event.button === 2 && event.altKey) {
      await actor.setStatusStacks(name, 0);
      return;
    }

    const amount = (event.ctrlKey || event.metaKey) ? 5 : 1;
    if (event.button === 2) await actor.removeStatusStacks(name, amount);
    else await actor.addStatusStacks(name, amount);
  }
}

export function registerStatusTraySettings() {
  game.settings.register("projectmoonttrpg", "showStatusTray", {
    name: "PMTTRPG.Settings.showStatusTray.name",
    hint: "PMTTRPG.Settings.showStatusTray.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => game.projectmoonttrpg?.statusTray?.refresh(),
  });
}

function peekItemType(uuid) {
  const synced = fromUuidSync(uuid);
  if (synced?.type) return synced.type;
  const parsed = foundry.utils.parseUuid(uuid);
  return parsed?.collection?.index?.get(parsed.id)?.type ?? null;
}

function tokenAtPoint(x, y) {
  return [...canvas.tokens.quadtree.getObjects(new PIXI.Rectangle(x, y))]
    .filter((t) => t.visible)
    .sort((a, b) => (b.document.elevation - a.document.elevation)
      || (b.document.sort - a.document.sort))[0] ?? null;
}

function showStatusScrollingText(actor, statusName, added) {
  if (!canvas.ready || !actor) return;
  const tokens = actor.getActiveTokens(true);
  if (!tokens.length) return;

  const content = `${added ? "+" : "-"} ${statusName}`;
  for (const token of tokens) {
    if (!token?.center) continue;
    canvas.interface.createScrollingText(token.center, content, {
      anchor: added ? CONST.TEXT_ANCHOR_POINTS.TOP : CONST.TEXT_ANCHOR_POINTS.BOTTOM,
      direction: added ? CONST.TEXT_ANCHOR_POINTS.TOP : CONST.TEXT_ANCHOR_POINTS.BOTTOM,
      fontSize: 28,
      fill: added ? 0xc79a4b : 0xcc6666,
      stroke: 0x000000,
      strokeThickness: 4,
      jitter: 0.25,
      duration: 2000,
    });
  }
}

async function applyStatusToTokenDrop(data) {
  const item = await fromUuid(data.uuid);
  if (!item || item.type !== "status") return;

  const actor = tokenAtPoint(data.x, data.y)?.actor;
  if (!actor) return;
  if (!actor.isOwner) {
    ui.notifications.warn(game.i18n.localize("PMTTRPG.StatusDropNoPermission"));
    return;
  }

  const stacks = Math.max(0, Math.trunc(Number(item.system?.stacks ?? 1) || 0));
  if (stacks > 0) await actor.addStatusStacks(item.name, stacks, item);
}

function registerStatusCanvasDrop() {
  Hooks.on("dropCanvasData", (_canvas, data) => {
    if (data?.type !== "Item" || !data.uuid) return;
    if (peekItemType(data.uuid) !== "status") return;
    void applyStatusToTokenDrop(data);
    return false;
  });
}

const pendingStatusClears = new Set();

function queueStatusClearedText(actor, statusName) {
  const key = `${actor.uuid}:${statusName}`;
  if (pendingStatusClears.has(key)) return;
  pendingStatusClears.add(key);
  queueMicrotask(() => {
    pendingStatusClears.delete(key);
    if (actor.getStatusStacks(statusName) === 0) {
      showStatusScrollingText(actor, statusName, false);
    }
  });
}

function registerStatusScrollingText() {
  Hooks.on("createItem", (item) => {
    if (item.type !== "status") return;
    const actor = item.parent ?? item.actor;
    if (!actor?.getStatusStacks) return;
    // Only the first time this status lands on the actor.
    if (actor.getStatusStacks(item.name) !== Number(item.system?.stacks ?? 1)) return;
    const others = actor.items.filter((i) => i.type === "status" && i.name === item.name && i.id !== item.id);
    if (others.length) return;
    showStatusScrollingText(actor, item.name, true);
  });
  Hooks.on("deleteItem", (item) => {
    if (item.type !== "status") return;
    const actor = item.parent ?? item.actor;
    if (!actor?.getStatusStacks) return;
    if (actor.getStatusStacks(item.name) !== 0) return;
    queueStatusClearedText(actor, item.name);
  });
}

export function registerStatusTray() {
  const tray = new StatusTray();
  game.projectmoonttrpg.statusTray = tray;

  const refresh = () => tray.refresh();
  Hooks.on("canvasReady", refresh);
  Hooks.on("controlToken", refresh);
  onStatusItemChange(refresh);
  Hooks.on("updateUser", (user, changes) => {
    if (user.id === game.user.id && ("character" in changes)) refresh();
  });

  registerStatusCanvasDrop();
  registerStatusScrollingText();
  tray.render({ force: true });
}
