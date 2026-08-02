import { PMTTRPGUtility } from "./utility.js";

export const PMTTRPG = {};

PMTTRPG.abilities = {
  "for": "PMTTRPG.AbilityFor",
  "pru": "PMTTRPG.AbilityPru",
  "jus": "PMTTRPG.AbilityJus",
  "cha": "PMTTRPG.AbilityCha",
  "ins": "PMTTRPG.AbilityIns",
  "tem": "PMTTRPG.AbilityTem"
};

PMTTRPG.rollResults = {
  failure: {
    start: null,
    end: 6,
    label: 'PMTTRPG.failure'
  },
  partial: {
    start: 7,
    end: 9,
    label: 'PMTTRPG.partial'
  },
  success: {
    start: 10,
    end: null,
    label: 'PMTTRPG.success'
  }
};

PMTTRPG.resistances = {
  "fatal": { label: 'PMTTRPG.ResistanceFatal', multiplier: 2 },
  "weak": { label: 'PMTTRPG.ResistanceWeak', multiplier: 1.5 },
  "normal": { label: 'PMTTRPG.ResistanceNormal', multiplier: 1 },
  "endured": { label: 'PMTTRPG.ResistanceEndured', multiplier: 0.5 },
  "ineffective": { label: 'PMTTRPG.ResistanceIneffective', multiplier: 0.25 },
  "immune": { label: 'PMTTRPG.ResistanceImmune', multiplier: 0 }
}