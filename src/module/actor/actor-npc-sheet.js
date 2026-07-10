import { PMTTRPGUtility } from "../utility.js";
import { PMTTRPGRolls } from "../rolls.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { TextEditor } = foundry.applications.ux;

export class PMTTRPGActorNpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  constructor(options = {}) {
    super(options);
    this.tagify = null;
  }

  static DEFAULT_OPTIONS = {
    classes: ["projectmoonttrpg", "sheet", "actor", "npc"],
    position: { width: 560, height: 640 },
    window: { resizable: true },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    
  };
}
