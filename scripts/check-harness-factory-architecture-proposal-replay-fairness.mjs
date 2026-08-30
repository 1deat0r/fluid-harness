import assert from 'node:assert/strict';

import {
  buildReplayFairnessFixture
} from './fixtures/harness-factory-proposal-replay-fairness.mjs';

const scenario = buildReplayFairnessFixture('harness-factory-proposal-replay-fairness');
const [oldest, middle, youngest] = scenario.batches;
const initial = scenario.replayItems();
assert.deepEqual(initial.map((item) => item.archive.sequence), [
  oldest.archive.sequence,
  middle.archive.sequence,
  youngest.archive.sequence
]);
assert.deepEqual(initial.map((item) => item.benchmark.replayAttemptCount), [0, 0, 0]);
const stableIds = new Map(initial.map((item) => [item.archive.sequence, item.id]));

assert.equal(scenario.attempt(oldest).status, 'REJECTED');
assert.equal(scenario.attempt(oldest).status, 'REJECTED');
assert.equal(scenario.attempt(middle).status, 'REJECTED');

const fair = scenario.replayItems();
assert.deepEqual(fair.map((item) => item.archive.sequence), [
  youngest.archive.sequence,
  middle.archive.sequence,
  oldest.archive.sequence
]);
assert.deepEqual(fair.map((item) => item.benchmark.replayAttemptCount), [0, 1, 2]);
assert.equal(
  fair.every((item) => item.id === stableIds.get(item.archive.sequence)),
  true,
  'attempt-aware scheduling must not replace backlog identities'
);
assert.deepEqual(
  scenario.replayPlans().map((plan) => plan.archive.sequence),
  fair.map((item) => item.archive.sequence)
);
assert.equal(fair.every(Object.isFrozen), true);
assert.equal(scenario.ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_FAIRNESS_OK `
  + `attempts=${fair.map((item) => item.benchmark.replayAttemptCount).join('+')} `
  + `order=${fair.map((item) => item.archive.sequence).join('>')} `
  + `stableIds=true plansMatch=true queued=${fair.length} `
  + `ledgerEntries=${scenario.ledger.length} verify=${scenario.ledger.verify()}`
);
