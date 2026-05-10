import { PMTTRPGActorSheet } from './actor-sheet.js';
import { PMTTRPGUtility } from '../utility.js';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class PMTTRPGActorNpcSheet extends PMTTRPGActorSheet {

  /** @override */
  static get defaultOptions() {
    let options = foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["projectmoonttrpg", "sheet", "actor", "npc"],
      width: 560,
      height: 640,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves" }]
    });

    if (PMTTRPGUtility.nightmode) {
      options.classes.push('nightmode');
    }

    return options;
  }

}