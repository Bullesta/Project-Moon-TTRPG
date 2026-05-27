/*
Project Moon TTRPG - Bleed status macro

Linked to a Bleed status item. This macro runs when the actor performs an
action or reaction that should suffer Bleed damage.
*/

const { status, actor, context } = scope;

if (!actor || !status) {
  console.log(`[PMTTRPG] Trying to trigger bleed, but no actor seems to be selected.`);
  return;
}

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getStatusCopies(targetActor, statusName) {
  return api.getStatusItems(targetActor).filter(item => normalizeName(item.name) === normalizeName(statusName));
}

if (context.event !== 'onActionOrReaction' && context.event !== 'onManualButton') {
  return;
}

const copies = getStatusCopies(actor, status.name);
if (!copies.length) {
  return;
}

const currentValue = Number(foundry.utils.getProperty(actor.system, 'attributes.hp.value') ?? 0);
const nextValue = Math.max(0, currentValue - copies.length);
await actor.update({ 'system.attributes.hp.value': nextValue });

const removeCount = copies.length - Math.floor(copies.length / 2);
const idsToRemove = copies.slice(-removeCount).map(item => item.id);
await actor.deleteEmbeddedDocuments('Item', idsToRemove);

console.log(`[PMTTRPG] Bleed triggered for ${actor.name}.`);
