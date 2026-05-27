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
    "systems/projectmoonttrpg/templates/parts/effects-list.html"
  ];

  // Load the template parts
  return foundry.applications.handlebars.loadTemplates(templatePaths);
};