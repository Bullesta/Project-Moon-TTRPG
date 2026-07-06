/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
 export const preloadHandlebarsTemplates = async function() {

  // Define template paths to load
  const templatePaths = [
    "systems/projectmoonttrpg/templates/parts/chat-buttons.html",
    "systems/projectmoonttrpg/templates/parts/sheet-moves.html",
    "systems/projectmoonttrpg/templates/parts/sheet-level-up-move.html",
    "systems/projectmoonttrpg/templates/parts/effects-list.html",
    // Character sheet (AppV2) partials referenced by main.hbs
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-main.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/attributes.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/augment.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/bios.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-weapons.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-outfits.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-skills.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-bios.hbs"
  ];

  // Load the template parts
  return foundry.applications.handlebars.loadTemplates(templatePaths);
};
