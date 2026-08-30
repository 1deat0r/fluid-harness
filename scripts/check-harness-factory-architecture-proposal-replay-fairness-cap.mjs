import assert from 'node:assert/strict';

import {
  buildReplayFairnessFixture
} from './fixtures/harness-factory-proposal-replay-fairness.mjs';

const scenario = buildReplayFairnessFixture('harness-factory-proposal-replay-fairness-cap');
const [oldest, middle, youngest] = scenario.batches;
const cappedReplay = () => {
  const full = scenario.factory.researchAgenda();
  const firstReplayIndex = full.items.findIndex(
    (item) => item.target === 'REPLAY_ARCHIVED_PROPOSALS'
  );
  assert.notEqual(firstReplayIndex, -1);
  const maxItems = firstReplayIndex + 1;
  const capped = scenario.factory.researchAgenda({ maxItems });
  return {
    capped,
    maxItems,
    replays: capped.items.filter((item) => item.target === 'REPLAY_ARCHIVED_PROPOSALS')
  };
};

assert.equal(scenario.attempt(oldest).status, 'REJECTED');
let selection = cappedReplay();
let selected = selection.replays;
assert.equal(selected.length, 1);
assert.deepEqual(selected[0].archive, middle.archive);
assert.equal(selected[0].benchmark.replayAttemptCount, 0);
assert.equal(selection.capped.truncated, true);

assert.equal(scenario.attempt(middle).status, 'REJECTED');
selection = cappedReplay();
selected = selection.replays;
assert.deepEqual(selected[0].archive, youngest.archive);
assert.equal(selected[0].benchmark.replayAttemptCount, 0);

assert.equal(scenario.attempt(youngest).status, 'REJECTED');
selection = cappedReplay();
selected = selection.replays;
assert.deepEqual(selected[0].archive, oldest.archive);
assert.equal(selected[0].benchmark.replayAttemptCount, 1);
const all = scenario.replayItems();
assert.deepEqual(all.map((item) => item.archive.sequence), [
  oldest.archive.sequence,
  middle.archive.sequence,
  youngest.archive.sequence
]);
assert.deepEqual(all.map((item) => item.benchmark.replayAttemptCount), [1, 1, 1]);
assert.equal(all.length, 3, 'rotation must retain every unfinished batch');
assert.equal(scenario.ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_FAIRNESS_CAP_OK `
  + `turns=${middle.archive.sequence}>${youngest.archive.sequence}>${oldest.archive.sequence} `
  + `attempts=${all.map((item) => item.benchmark.replayAttemptCount).join('+')} `
  + `retained=${all.length} replaySlots=1 maxItems=${selection.maxItems} truncated=true `
  + `ledgerEntries=${scenario.ledger.length} verify=${scenario.ledger.verify()}`
);
