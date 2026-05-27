/*
Project Moon TTRPG - Sinking status macro

Linked to a Sinking status item. This macro can burst Sinking on demand when
the attacker chooses to proc it, and it always clears Sinking at the end of the
round.
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

async function promptBurst(label) {
  return new Promise(resolve => {
    new Dialog({
      title: label,
      content: `<p>${label}</p>`,
      buttons: {
        burst: {
          label: 'Burst',
          callback: () => resolve(true)
        },
        skip: {
          label: 'Skip',
          callback: () => resolve(false)
        }
      },
      default: 'skip',
      close: () => resolve(false)
    }).render(true);
  });
}

async function applyResourceDamage(targetActor, amount) {
  const hasSpResource = Number(foundry.utils.getProperty(targetActor.system, 'attributes.sp.maxBase') ?? 0) > 0
    || Number(foundry.utils.getProperty(targetActor.system, 'attributes.sp.max') ?? 0) > 0;
  const resourcePath = hasSpResource ? 'attributes.sp.value' : 'attributes.hp.value';
  const currentValue = Number(foundry.utils.getProperty(targetActor.system, resourcePath) ?? 0);
  const nextValue = Math.max(0, currentValue - amount);
  await targetActor.update({ [`system.${resourcePath}`]: nextValue });
}

const copies = getStatusCopies(actor, status.name);
if (!copies.length) {
  return;
}

if (context.event === 'onTurnEnd') {
  await actor.deleteEmbeddedDocuments('Item', copies.map(item => item.id));
  console.log(`[PMTTRPG] Sinking cleared for ${actor.name} at end of round.`);
  return;
}

if (context.event !== 'onHitEnemy' && context.event !== 'onManualButton') {
  return;
}

const shouldBurst = context.event === 'onManualButton' ? true : await promptBurst(`Proc Sinking for ${actor.name}?`);
if (!shouldBurst) {
  return;
}

await applyResourceDamage(actor, copies.length);
await actor.deleteEmbeddedDocuments('Item', copies.map(item => item.id));

console.log(`[PMTTRPG] Sinking burst for ${actor.name}.`);