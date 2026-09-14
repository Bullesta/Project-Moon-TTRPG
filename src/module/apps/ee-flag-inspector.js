import { getPersistentFlag, isValidFlagValue, listPersistentFlags } from "../easy-effects/ee-meta.js";
import { runEEMetaPatch } from "../easy-effects/gm-route.js";
import { pmttrpgDialogClasses, pmttrpgDialogPosition } from "./dialog-classes.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const INSPECTOR_HOSTS = new Set(["Actor", "Item", "Combat"]);
const instances = new Map();

const TYPE_OPTIONS = {
  number: "PMTTRPG.EEFlagInspector.TypeNumber",
  string: "PMTTRPG.EEFlagInspector.TypeString",
  boolean: "PMTTRPG.EEFlagInspector.TypeBoolean",
};

function isInspectorHost(doc) {
  return INSPECTOR_HOSTS.has(doc?.documentName);
}

function inspectorAppId(uuid) {
  return `pmttrpg-ee-flag-inspector-${String(uuid).replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function flagValueType(value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "string";
}

function parseFlagInput(type, raw) {
  if (type === "boolean") {
    if (raw === true || raw === false) return raw;
    const text = String(raw ?? "").trim().toLowerCase();
    if (text === "true") return true;
    if (text === "false") return false;
    return undefined;
  }

  if (type === "number") {
    const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
    return Number.isFinite(n) ? n : undefined;
  }

  return String(raw ?? "");
}

function eeMetaTouched(changed) {
  return foundry.utils.hasProperty(changed, "flags.projectmoonttrpg.eeMeta")
    || foundry.utils.hasProperty(changed, "flags.projectmoonttrpg.-=eeMeta")
    || foundry.utils.hasProperty(changed, "flags.-=projectmoonttrpg");
}

function defaultDraftValue(type) {
  if (type === "boolean") return "false";
  return "";
}

function forgetInspector(app) {
  const uuid = String(app?.document?.uuid ?? "");
  if (uuid && instances.get(uuid) === app) instances.delete(uuid);
}

export function openEEFlagInspector(doc) {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n.localize("PMTTRPG.EEFlagInspector.GmOnly"));
    return null;
  }

  if (!isInspectorHost(doc)) {
    ui.notifications?.warn(game.i18n.localize("PMTTRPG.EEFlagInspector.UnsupportedHost"));
    return null;
  }

  const uuid = String(doc.uuid ?? "").trim();
  if (!uuid) return null;

  const existing = instances.get(uuid);
  if (existing) {
    if (existing.rendered) {
      if (typeof existing.bringToFront === "function") existing.bringToFront();
      else existing.render({ force: true });
      return existing;
    }
    instances.delete(uuid);
  }

  const app = new EEFlagInspector({ document: doc });
  instances.set(uuid, app);
  app.render({ force: true }).catch((err) => {
    forgetInspector(app);
    throw err;
  });
  return app;
}

export class EEFlagInspector extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @type {Actor|Item|Combat} */
  #document;

  #draft = { key: "", type: "number", value: "" };

  #pendingRefresh = false;

  #suppressMetaRefresh = false;

  #listenersBound = false;

  constructor(options = {}) {
    const { document: doc, ...appOptions } = options;
    const uuid = String(doc?.uuid ?? "");
    appOptions.id = inspectorAppId(uuid);
    super(appOptions);
    this.#document = doc;
  }

  static DEFAULT_OPTIONS = {
    id: "pmttrpg-ee-flag-inspector",
    classes: ["projectmoonttrpg", "pm-ee-flags"],
    tag: "div",
    position: { width: 400 },
    window: {
      title: "PMTTRPG.EEFlagInspector.Title",
      icon: "fa-solid fa-flag",
      resizable: true,
      contentClasses: ["standard-form"],
    },
    actions: {
      addFlag: EEFlagInspector.prototype._onAddFlag,
      clearFlag: EEFlagInspector.prototype._onClearFlag,
      clearAll: EEFlagInspector.prototype._onClearAll,
    },
  };

  static PARTS = {
    main: {
      template: "systems/projectmoonttrpg/templates/apps/ee-flag-inspector.hbs",
      root: true,
    },
  };

  /** @override */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    options.classes = (options.classes ?? []).filter((cls) => cls !== "nightmode");
    return options;
  }

  /** @override */
  get title() {
    const name = this.#document?.name || this.#document?.documentName || "";
    return game.i18n.format("PMTTRPG.EEFlagInspector.TitleNamed", { name });
  }

  get document() {
    return this.#document;
  }

  /** @override */
  async _prepareContext(_options) {
    const rows = listPersistentFlags(this.#document).map((row) => {
      const type = flagValueType(row.value);
      return {
        key: row.key,
        value: row.value,
        type,
        isBoolean: type === "boolean",
        isNumber: type === "number",
      };
    });

    return {
      rows,
      hasRows: rows.length > 0,
      draft: this.#draft,
      draftIsBoolean: this.#draft.type === "boolean",
      draftIsNumber: this.#draft.type === "number",
      typeOptions: TYPE_OPTIONS,
    };
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    if (this.#listenersBound || !this.element) return;
    this.#listenersBound = true;
    this.#bindDocumentHooks();
    this.element.addEventListener("change", this.#onChange);
    this.element.addEventListener("input", this.#onDraftInput);
    this.element.addEventListener("focusout", this.#onFocusOut);
  }

  /** @override */
  async _onClose(options) {
    this.#unbindDocumentHooks();
    if (this.element) {
      this.element.removeEventListener("change", this.#onChange);
      this.element.removeEventListener("input", this.#onDraftInput);
      this.element.removeEventListener("focusout", this.#onFocusOut);
    }
    this.#listenersBound = false;
    forgetInspector(this);
    return super._onClose(options);
  }

  #bindDocumentHooks() {
    const name = this.#document?.documentName;
    const updateHook = { Actor: "updateActor", Item: "updateItem", Combat: "updateCombat" }[name];
    const deleteHook = { Actor: "deleteActor", Item: "deleteItem", Combat: "deleteCombat" }[name];
    if (updateHook) Hooks.on(updateHook, this.#onDocumentUpdate);
    if (deleteHook) Hooks.on(deleteHook, this.#onDocumentDelete);
  }

  #unbindDocumentHooks() {
    const name = this.#document?.documentName;
    const updateHook = { Actor: "updateActor", Item: "updateItem", Combat: "updateCombat" }[name];
    const deleteHook = { Actor: "deleteActor", Item: "deleteItem", Combat: "deleteCombat" }[name];
    if (updateHook) Hooks.off(updateHook, this.#onDocumentUpdate);
    if (deleteHook) Hooks.off(deleteHook, this.#onDocumentDelete);
  }

  /**
   * Combat updates actors constantly. Refresh only when eeMeta changed, and
   * wait if a field is still being edited.
   */
  #onDocumentUpdate = (doc, changed) => {
    if (this.#suppressMetaRefresh) return;
    if (doc?.uuid !== this.#document?.uuid) return;
    if (!eeMetaTouched(changed)) return;
    if (this.#isEditing()) {
      this.#pendingRefresh = true;
      return;
    }
    this.render({ force: true });
  };

  #onDocumentDelete = (doc) => {
    if (doc?.uuid === this.#document?.uuid) this.close();
  };

  #isEditing() {
    const active = document.activeElement;
    if (!active || !this.element?.contains(active)) return false;
    const tag = active.tagName;
    return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
  }

  #onFocusOut = () => {
    queueMicrotask(() => {
      if (!this.#pendingRefresh || this.#isEditing()) return;
      this.#pendingRefresh = false;
      this.render({ force: true });
    });
  };

  #onDraftInput = (event) => {
    const field = event.target?.dataset?.draft;
    if (!field) return;
    this.#readDraftFromElement();
  };

  #onChange = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.dataset.draft) {
      this.#readDraftFromElement();
      if (target.dataset.draft === "type") {
        this.#draft.value = defaultDraftValue(this.#draft.type);
        await this.render({ force: true });
      }
      return;
    }

    const row = target.closest("[data-flag-key]");
    const field = target.dataset.field;
    if (!row || !field) return;

    const key = row.dataset.flagKey;
    if (!key) return;

    const type = field === "type"
      ? target.value
      : (row.querySelector("[data-field='type']")?.value ?? "string");
    const raw = field === "value"
      ? target.value
      : (row.querySelector("[data-field='value']")?.value ?? "");

    let value = parseFlagInput(type, raw);
    if (field === "type" && (value === undefined || !isValidFlagValue(value))) {
      value = type === "boolean" ? false : type === "number" ? 0 : String(raw ?? "");
    }
    if (value === undefined || !isValidFlagValue(value)) {
      ui.notifications?.warn(game.i18n.localize("PMTTRPG.EEFlagInspector.InvalidValue"));
      await this.render({ force: true });
      return;
    }

    await this.#write({ set: { [key]: value } });
  };

  async #write(patch) {
    this.#suppressMetaRefresh = true;
    try {
      await runEEMetaPatch(this.#document, patch);
      this.#pendingRefresh = false;
      await this.render({ force: true });
    } finally {
      this.#suppressMetaRefresh = false;
    }
  }

  #readDraftFromElement() {
    const root = this.element;
    if (!root) return;
    this.#draft = {
      key: root.querySelector("[data-draft='key']")?.value ?? "",
      type: root.querySelector("[data-draft='type']")?.value ?? "number",
      value: root.querySelector("[data-draft='value']")?.value ?? "",
    };
  }

  async _onAddFlag() {
    this.#readDraftFromElement();
    const key = String(this.#draft.key ?? "").trim();
    if (!key) {
      ui.notifications?.warn(game.i18n.localize("PMTTRPG.EEFlagInspector.InvalidKey"));
      return;
    }

    const value = parseFlagInput(this.#draft.type, this.#draft.value);
    if (value === undefined || !isValidFlagValue(value)) {
      ui.notifications?.warn(game.i18n.localize("PMTTRPG.EEFlagInspector.InvalidValue"));
      return;
    }

    const type = this.#draft.type;
    this.#draft = { key: "", type, value: defaultDraftValue(type) };
    await this.#write({ set: { [key]: value } });
  }

  async _onClearFlag(_event, target) {
    const key = target.dataset.flagKey ?? target.closest("[data-flag-key]")?.dataset.flagKey;
    if (!key) return;
    await this.#write({ unset: [key] });
  }

  async _onClearAll() {
    const keys = listPersistentFlags(this.#document).map((row) => row.key);
    if (!keys.length) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("PMTTRPG.EEFlagInspector.ClearAllTitle") },
      position: pmttrpgDialogPosition(),
      classes: pmttrpgDialogClasses(),
      content: `<p>${game.i18n.format("PMTTRPG.EEFlagInspector.ClearAllConfirm", {
        name: this.#document?.name || this.#document?.documentName || "",
      })}</p>`,
      rejectClose: false,
      modal: true,
    });
    if (!confirmed) return;

    await this.#write({ unset: keys });
  }
}

export const eeFlagsAPI = {
  list: listPersistentFlags,
  get(doc, key) {
    return getPersistentFlag(null, doc, key);
  },
  set(doc, key, value) {
    return runEEMetaPatch(doc, { set: { [key]: value } });
  },
  clear(doc, key) {
    return runEEMetaPatch(doc, { unset: [key] });
  },
  open: openEEFlagInspector,
};
