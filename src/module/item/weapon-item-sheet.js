import { PMTTRPGItemSheet } from "./item-sheet.js";

export class PMTTRPGWeaponItemSheet extends PMTTRPGItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["projectmoonttrpg", "sheet", "item", "weapon"],
      width: 560,
      height: 620,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      submitOnChange: true,
    });
  }

  /** @override */
  get template() {
    const path = "systems/projectmoonttrpg/templates/items";
    return `${path}/weapon-sheet.html`;
  }

  /** @override */
  async getData() {
    const context = await super.getData();
    context.selects = context.selects || {};

    context.selects.weaponTypes = {
      melee: "PMTTRPG.WeaponTypeMelee",
      ranged: "PMTTRPG.WeaponTypeRanged"
    };

    context.selects.damageTypes = {
      slash: "PMTTRPG.DamageTypeSlash",
      pierce: "PMTTRPG.DamageTypePierce",
      blunt: "PMTTRPG.DamageTypeBlunt"
    };

    context.selects.formPropertiesMelee = {
      small: "PMTTRPG.FormPropertySmall",
      medium: "PMTTRPG.FormPropertyMedium",
      long: "PMTTRPG.FormPropertyLong",
      sturdy: "PMTTRPG.FormPropertySturdy",
      hybrid: "PMTTRPG.FormPropertyHybridMelee",
      versatile: "PMTTRPG.FormPropertyVersatile",
      innate: "PMTTRPG.FormPropertyInnateMelee"
    };

    context.selects.formPropertiesRanged = {
      lowCaliber: "PMTTRPG.FormPropertyLowCaliber",
      highCaliber: "PMTTRPG.FormPropertyHighCaliber",
      reactive: "PMTTRPG.FormPropertyReactive",
      hybrid: "PMTTRPG.FormPropertyHybridRanged",
      recoil: "PMTTRPG.FormPropertyRecoil",
      innate: "PMTTRPG.FormPropertyInnateRanged"
    };

    context.selects.handPropertiesMelee = {
      off1h: "PMTTRPG.HandPropertyOff1H",
      off2h: "PMTTRPG.HandPropertyOff2H",
      def1h: "PMTTRPG.HandPropertyDef1H",
      def2h: "PMTTRPG.HandPropertyDef2H"
    };

    context.selects.handPropertiesRanged = {
      off1h: "PMTTRPG.HandPropertyOff1H",
      off2h: "PMTTRPG.HandPropertyOff2H"
    };

    return context;
  }
}
