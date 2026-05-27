/*
Project Moon TTRPG - Poise status macro

Linked to a Poise status item. This example rolls a d10 when the actor is hit
and can convert Poise into Critical.
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

function getStatusTemplate(statusName) {
  return game.items?.find(item => item.type === 'status' && normalizeName(item.name) === normalizeName(statusName)) ?? null;
}

async function createStatusCopy(targetActor, statusName, sourceStatus = null) {
  const template = getStatusTemplate(statusName);
  const source = template?.toObject?.() ?? {
    type: 'status',
    name: statusName,
    img: sourceStatus?.img ?? 'icons/svg/aura.svg',
    system: {
      description: '',
      proc: {
        turnStart: false,
        endOfRound: false,
        actionOrReaction: false,
        attackerBurst: false,
        onHitWhenActorHas: false,
        onHitWhenTargetHas: false,
        alwaysActive: false,
        skillEffect: false,
      },
      macro: { uuid: '' },
      customNotes: '',
    },
  };

  delete source._id;
  delete source.id;
  delete source.uuid;
  source.name = statusName;
  source.type = 'status';

  await targetActor.createEmbeddedDocuments('Item', [source]);
}

const copies = getStatusCopies(actor, status.name);
if (!copies.length) {
  return;
}

if (context.event !== 'onHitSelf' && context.event !== 'onManualButton') {
  return;
}

const roll = Math.ceil(Math.random() * 10);
const poiseNumber = copies.length;
console.log(`[PMTTRPG] Poise roll for ${actor.name}: ${roll} vs ${poiseNumber}`);

if (roll > poiseNumber) {
  return;
}

await actor.deleteEmbeddedDocuments('Item', copies.map(item => item.id));
await createStatusCopy(actor, 'Critical', status);

if (!getStatusCopies(actor, 'Poise').length) {
  await createStatusCopy(actor, 'Poise', status);
}

console.log(`[PMTTRPG] Poise converted to Critical for ${actor.name}.`);