/*
Project Moon TTRPG - Critical status macro

Linked to a Critical status item. This example consumes Critical for bonus HP
damage when you trigger it manually. It also keeps the companion Poise status
present if Critical exists and Poise is missing.
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

async function dealDamage(targetActor, amount) {
  const currentValue = Number(foundry.utils.getProperty(targetActor.system, 'attributes.hp.value') ?? 0);
  const nextValue = Math.max(0, currentValue - amount);
  await targetActor.update({ 'system.attributes.hp.value': nextValue });
}

const copies = getStatusCopies(actor, status.name);
if (!copies.length) {
  return;
}

if (context.event === 'onManualButton') {
  const targetActor = context.payload?.targetActor ?? (context.payload?.targetActorId ? game.actors?.get(context.payload.targetActorId) : null);
  if (!targetActor) {
    ui.notifications.warn('Critical needs a targetActorId in the payload to deal extra damage.');
    return;
  }

  const roll = await (new Roll(`${copies.length}d10`)).evaluate({ async: true });
  await dealDamage(targetActor, roll.total);
  await actor.deleteEmbeddedDocuments('Item', copies.map(item => item.id));
  console.log(`[PMTTRPG] Critical spent by ${actor.name} on ${targetActor.name}.`);
}

if (!getStatusCopies(actor, 'Poise').length) {
  await createStatusCopy(actor, 'Poise', status);
}