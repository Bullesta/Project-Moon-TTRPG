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

PMTTRPG.panicTypes = {
  "fight": {
    label: "PMTTRPG.Panic.Fight",
    icon: "systems/projectmoonttrpg/assets/icons/sheet/SanityIcons_Fight.webp",
    associatedStatus: "Panic [Fight]"
  },
  "flight": {
    label: "PMTTRPG.Panic.Flight",
    icon: "systems/projectmoonttrpg/assets/icons/sheet/SanityIcons_Flight.webp",
    associatedStatus: "Panic [Flight]"
  },
  "fawn": {
    label: "PMTTRPG.Panic.Fawn",
    icon: "systems/projectmoonttrpg/assets/icons/sheet/SanityIcons_Fawn.webp",
    associatedStatus: "Panic [Fawn]"
  },
  "freeze": {
    label: "PMTTRPG.Panic.Freeze",
    icon: "systems/projectmoonttrpg/assets/icons/sheet/SanityIcons_Freeze.webp",
    associatedStatus: "Panic [Freeze]"
  },
  "none": {
    label: "PMTTRPG.Panic.NotPanicking",
    icon: null,
    associatedStatus: null
  }
}

PMTTRPG.sanityVisualThresholds = [
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/SanityIcons_SanityBase.webp",
    activateIntervalPercent: [90, 100],
  },
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/SanityIcons_SanityDegrade1.webp",
    activateIntervalPercent: [50, 90] 
  },
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/SanityIcons_SanityDegrade2.webp",
    activateIntervalPercent: [1, 50] 
  },
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/SanityIcons_SanityDegrade2.webp",
    activateIntervalPercent: [-1, 1] 
  }
]

PMTTRPG.staggerVisualThresholds = [
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/Guard_Stagger_Undamaged.webp",
    activateIntervalPercent: [90, 100],
  },
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/Guard_Stagger.webp",
    activateIntervalPercent: [50, 90] 
  },
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/Guard_Stagger_Damaged1.webp",
    activateIntervalPercent: [1, 50] 
  },
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/Guard_Stagger_Damaged1_Greyed.webp",
    activateIntervalPercent: [-1, 1] 
  }
]

PMTTRPG.healthVisualThresholds = [
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/hp_healthyplus.webp",
    activateIntervalPercent: [90, 100],
  },
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/hp_healthy.webp",
    activateIntervalPercent: [50, 90] 
  },
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/hp_damaged.webp",
    activateIntervalPercent: [25, 50] 
  },
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/hp_broken.webp",
    activateIntervalPercent: [1, 25] 
  },
  {
    icon: "systems/projectmoonttrpg/assets/icons/sheet/hp_gray.webp",
    activateIntervalPercent: [-1, 1] 
  }
]