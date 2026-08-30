import assert from 'node:assert/strict';

import {
  buildReplayFairnessFixture,
  REPLAY_ARCHIVED_PROPOSALS
} from './fixtures/harness-factory-proposal-replay-fairness.mjs';

const scenario = buildReplayFairnessFixture(
  'harness-factory-proposal-replay-exhaustion-fairness'
);
const [oldest, middle, youngest] = scenario.batches;
const initial = scenario.replayItems();
const ids = new Map(initial.map((item) => [item.archive.sequence, item.id]));

assert.equal(scenario.attempt(oldest).status, 'REJECTED');
assert.equal(scenario.attempt(oldest).status, 'REJECTED');
assert.equal(scenario.attempt(oldest).status, 'REJECTED');
assert.equal(scenario.attempt(middle).status, 'REJECTED');

const conversion = scenario.factory.architectureProposalConversion();
const exhausted = conversion.batches.find(
  (batch) => batch.archive.sequence === oldest.archive.sequence
);
assert.equal(exhausted.status, 'EXHAUSTED');
assert.equal(exhausted.replayExhausted, true);
const queued = scenario.replayItems();
assert.deepEqual(queued.map((item) => item.archive.sequence), [
  youngest.archive.sequence,
  middle.archive.sequence
]);
assert.deepEqual(queued.map((item) => item.benchmark.replayAttemptCount), [0, 1]);
assert.equal(queued.some((item) => item.archive.sequence === oldest.archive.sequence), false);
assert.equal(queued.every((item) => item.id === ids.get(item.archive.sequence)), true);
const plans = scenario.replayPlans();
assert.deepEqual(
  plans.map((plan) => plan.archive.sequence),
  queued.map((item) => item.archive.sequence)
);
assert.equal(plans.every((plan) => plan.target === REPLAY_ARCHIVED_PROPOSALS), true);

const full = scenario.factory.researchAgenda();
const firstReplayIndex = full.items.findIndex((item) => item.target === REPLAY_ARCHIVED_PROPOSALS);
const capped = scenario.factory.researchAgenda({ maxItems: firstReplayIndex + 1 });
const cappedReplay = capped.items.filter((item) => item.target === REPLAY_ARCHIVED_PROPOSALS);
assert.equal(cappedReplay.length, 1);
assert.deepEqual(cappedReplay[0].archive, youngest.archive);
assert.equal(scenario.ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_EXHAUSTION_FAIRNESS_OK `
  + `exhausted=${oldest.archive.sequence} queued=${queued.map((item) => item.archive.sequence).join('>')} `
  + `attempts=${queued.map((item) => item.benchmark.replayAttemptCount).join('+')} `
  + `stableIds=true cappedFirst=${cappedReplay[0].archive.sequence} `
  + `ledgerEntries=${scenario.ledger.length} verify=${scenario.ledger.verify()}`
);
