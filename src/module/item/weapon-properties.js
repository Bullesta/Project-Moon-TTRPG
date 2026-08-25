/**
 * Weapon dropdowns should always have a valid value.
 *
 * If a form or hand property is blank, or doesn't belong to the current
 * weapon type, the UI can look correct while the stored value is still wrong.
 * That can also prevent the expected bonus from being applied.
 *
 * These helpers keep weapon type, form, and hand values in sync so
 * prepareData, clash rolls, and melee/ranged switching all behave the same way.
 */

const MELEE_FORMS = new Set([
  "small", "medium", "long", "sturdy", "hybrid", "versatile", "innate",
]);

const RANGED_FORMS = new Set([
  "lowCaliber", "highCaliber", "reactive", "hybrid", "recoil", "innate",
]);

const MELEE_HANDS = new Set(["off1h", "off2h", "def1h", "def2h"]);
const RANGED_HANDS = new Set(["off1h", "off2h"]);

export const DEFAULT_WEAPON_HAND_PROPERTY = "off1h";
export const DEFAULT_MELEE_FORM_PROPERTY = "small";
export const DEFAULT_RANGED_FORM_PROPERTY = "lowCaliber";

/**
 * Normalizes a weapon type.
 *
 * Melee is the default, so only an explicit `"ranged"` value is treated
 * as ranged. Blank, null, or unknown values fall back to melee.
 *
 * @param {string|null|undefined} weaponType
 * @returns {"melee"|"ranged"}
 */
export function normalizeWeaponType(weaponType) {
  if (weaponType === "ranged") return "ranged";
  return "melee";
}

/**
 * Returns the default form property for a weapon type.
 *
 * Melee weapons default to Small, while ranged weapons default to Low Caliber.
 *
 * @param {string|null|undefined} weaponType
 * @returns {string}
 */
export function defaultFormProperty(weaponType) {
  return normalizeWeaponType(weaponType) === "ranged"
    ? DEFAULT_RANGED_FORM_PROPERTY
    : DEFAULT_MELEE_FORM_PROPERTY;
}

/**
 * Makes sure the form property is valid for the current weapon type.
 *
 * If it isn't, the weapon falls back to the default form for that type.
 * This also prevents stale values when switching between melee and ranged,
 * such as keeping Small stored after changing a weapon to ranged.
 *
 * @param {string|null|undefined} weaponType
 * @param {string|null|undefined} formProperty
 * @returns {string}
 */
export function normalizeWeaponFormProperty(weaponType, formProperty) {
  const allowed = normalizeWeaponType(weaponType) === "ranged"
    ? RANGED_FORMS
    : MELEE_FORMS;

  return allowed.has(formProperty)
    ? formProperty
    : defaultFormProperty(weaponType);
}

/**
 * Makes sure the hand property is valid for the current weapon type.
 *
 * Ranged weapons currently only support Offensive 1H and Offensive 2H. If a weapon
 * has an invalid or blank hand value, it falls back to Offensive 1H.
 *
 * @param {string|null|undefined} weaponType
 * @param {string|null|undefined} handProperty
 * @returns {string}
 */
export function normalizeWeaponHandProperty(weaponType, handProperty) {
  const allowed = normalizeWeaponType(weaponType) === "ranged"
    ? RANGED_HANDS
    : MELEE_HANDS;

  return allowed.has(handProperty)
    ? handProperty
    : DEFAULT_WEAPON_HAND_PROPERTY;
}

/**
 * Normalizes all weapon properties in one pass.
 *
 * This keeps the weapon type, form, and hand values valid together.
 * Used by prepareData, migrateData, clash rolls, and _preUpdate when
 * switching a weapon between melee and ranged.
 *
 * @param {{
 *   weaponType?: string|null,
 *   formProperty?: string|null,
 *   handProperty?: string|null
 * }|null|undefined} system
 * @returns {{
 *   weaponType: "melee"|"ranged",
 *   formProperty: string,
 *   handProperty: string
 * }}
 */
export function normalizeWeaponProperties(system = {}) {
  const weaponType = normalizeWeaponType(system.weaponType);

  return {
    weaponType,
    formProperty: normalizeWeaponFormProperty(
      weaponType,
      system.formProperty
    ),
    handProperty: normalizeWeaponHandProperty(
      weaponType,
      system.handProperty
    ),
  };
}