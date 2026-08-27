import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  HarnessFactory,
  MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORY_ENTRIES,
  isTrustedHarnessFactoryArchitectureProposalHistoryReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-archive-history',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, discoveryRunner } = fixture;
const batchCount = MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORY_ENTRIES + 1;

for (let index = 0; index < batchCount; index += 1) {
  const report = factory.proposeArchitectures({
    goal: `preserve proposal batch ${index + 1}`,
    plannerCandidates: [plannerCandidate],
    archive: true
  });
  assert.equal(report.archived, true);
  assert.equal(report.dataOnly, true);
  assert.equal(report.authorityTransferred, false);
}

const history = factory.architectureProposalHistory();
assert.equal(isTrustedHarnessFactoryArchitectureProposalHistoryReport(history), true);
assert.equal(history.consideredBatchCount, batchCount);
assert.equal(history.returnedBatchCount, MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORY_ENTRIES);
assert.equal(history.maxEntries, MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORY_ENTRIES);
assert.equal(history.truncated, true);
assert.equal(history.complete, false);
assert.equal(history.batches[0].archive.sequence, 2);
assert.equal(history.batches.at(-1).archive.sequence, batchCount);
assert.equal(history.batches.at(-1).dataOnly, true);
assert.equal(history.batches.at(-1).authorityTransferred, false);
assert.equal(Object.hasOwn(history.batches.at(-1), 'candidate'), false);
assert.equal(Object.hasOwn(history.batches.at(-1).proposals[0], 'runner'), false);
assert.equal(ledger.length, batchCount);
assert.equal(ledger.verify(), true);

const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const restoredFactory = new HarnessFactory({
  factoryId: factory.factoryId,
  discoveryRunner,
  ledger: restoredLedger
});
const restoredHistory = restoredFactory.architectureProposalHistory();
assert.deepEqual(restoredHistory, history);
assert.equal(restoredLedger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_ARCHIVE_HISTORY_OK considered=${history.consideredBatchCount} `
  + `returned=${history.returnedBatchCount} max=${history.maxEntries} truncated=${history.truncated} `
  + `firstSequence=${history.batches[0].archive.sequence} lastSequence=${history.batches.at(-1).archive.sequence} `
  + `roundTrip=${restoredHistory.returnedBatchCount}`
);
