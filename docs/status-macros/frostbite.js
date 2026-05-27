/*
Project Moon TTRPG - Frostbite status macro

Linked to a Frostbite status item. This macro runs when Frostbite is triggered,
usually at the end of the actor's turn.
*/

const { status, actor, context } = scope;

if (!actor || !status) {
  return;
}

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getStatusCopies(targetActor, statusName) {
  return api.getStatusItems(targetActor).filter(item => normalizeName(item.name) === normalizeName(statusName));
}

if (context.event !== 'onTurnEnd' && context.event !== 'onManualButton') {
  return;
}

const copies = getStatusCopies(actor, status.name);
if (!copies.length) {
  return;
}

const currentValue = Number(foundry.utils.getProperty(actor.system, 'attributes.st.value') ?? 0);
const nextValue = Math.max(0, currentValue - copies.length);
await actor.update({ 'system.attributes.st.value': nextValue });

const removeCount = copies.length - Math.floor(copies.length / 2);
const idsToRemove = copies.slice(-removeCount).map(item => item.id);
await actor.deleteEmbeddedDocuments('Item', idsToRemove);

console.log(`[PMTTRPG] Frostbite triggered for ${actor.name}.`);
