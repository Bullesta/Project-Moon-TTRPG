/*
Project Moon TTRPG - Tremor status macro

Linked to a Tremor status item. This macro can burst Tremor on demand when
the attacker chooses to proc it, and it always clears Tremor at the end of the
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

async function applyStDamage(targetActor, amount) {
  const currentValue = Number(foundry.utils.getProperty(targetActor.system, 'attributes.st.value') ?? 0);
  const nextValue = Math.max(0, currentValue - amount);
  await targetActor.update({ 'system.attributes.st.value': nextValue });
}

const copies = getStatusCopies(actor, status.name);
if (!copies.length) {
  return;
}

if (context.event === 'onTurnEnd') {
  await actor.deleteEmbeddedDocuments('Item', copies.map(item => item.id));
  console.log(`[PMTTRPG] Tremor cleared for ${actor.name} at end of round.`);
  return;
}

if (context.event !== 'onHitEnemy' && context.event !== 'onManualButton') {
  return;
}

const shouldBurst = context.event === 'onManualButton' ? true : await promptBurst(`Proc Tremor for ${actor.name}?`);
if (!shouldBurst) {
  return;
}

await applyStDamage(actor, copies.length);
await actor.deleteEmbeddedDocuments('Item', copies.map(item => item.id));

console.log(`[PMTTRPG] Tremor burst for ${actor.name}.`);