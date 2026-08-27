import assert from 'node:assert/strict';

import {
  MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES,
  isTrustedHarnessFactoryArchitectureProposalConversionReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-conversion',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

const empty = factory.architectureProposalConversion();
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalConversionReport(empty),
  true
);
assert.equal(empty.factoryId, factory.factoryId);
assert.equal(empty.consideredBatchCount, 0);
assert.equal(empty.returnedBatchCount, 0);
assert.equal(empty.archivedProposalCount, 0);
assert.equal(empty.archivedFingerprintCount, 0);
assert.equal(empty.evaluatedFingerprintCount, 0);
assert.equal(empty.convertedFingerprintCount, 0);
assert.equal(empty.untestedFingerprintCount, 0);
assert.equal(empty.conversionRate, 0);
assert.equal(empty.replayedBatchCount, 0);
assert.equal(empty.convertedBatchCount, 0);
assert.equal(empty.untestedBatchCount, 0);
assert.equal(empty.truncated, false);
assert.equal(empty.complete, true);
assert.equal(empty.maxEntries, MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES);
assert.equal(empty.dataOnly, true);
assert.equal(empty.authorityTransferred, false);

const batchA = factory.proposeArchitectures({
  goal: 'archive a proposal batch that has not been tested yet',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const untested = factory.architectureProposalConversion();
assert.equal(untested.consideredBatchCount, 1);
assert.equal(untested.archivedProposalCount, 1);
assert.equal(untested.archivedFingerprintCount, 1);
assert.equal(untested.evaluatedFingerprintCount, 0);
assert.equal(untested.convertedFingerprintCount, 0);
assert.equal(untested.untestedFingerprintCount, 1);
assert.equal(untested.conversionRate, 0);
assert.equal(untested.untestedBatchCount, 1);
assert.equal(untested.batches[0].status, 'UNTESTED');
assert.equal(untested.batches[0].replayed, false);
assert.equal(untested.batches[0].convertedFingerprintCount, 0);
assert.deepEqual(untested.batches[0].archive, batchA.archive);

const generation = factory.manufacture({
  goal: 'independently evaluate the archived architecture',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
const converted = factory.architectureProposalConversion();
assert.equal(converted.consideredBatchCount, 1);
assert.equal(converted.evaluatedFingerprintCount, 1);
assert.equal(converted.convertedFingerprintCount, 1);
assert.equal(converted.untestedFingerprintCount, 0);
assert.equal(converted.conversionRate, 1);
assert.equal(converted.convertedBatchCount, 1);
assert.equal(converted.replayedBatchCount, 0);
assert.equal(converted.untestedBatchCount, 0);
assert.equal(converted.batches[0].status, 'CONVERTED');
assert.equal(converted.batches[0].convertedFingerprintCount, 1);
assert.equal(converted.batches[0].replayed, false);
assert.equal(generation.generation, 1);

const batchB = factory.proposeArchitectures({
  goal: 'archive a later batch that no later evaluation has tested',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const mixed = factory.architectureProposalConversion();
assert.equal(mixed.consideredBatchCount, 2);
assert.equal(mixed.convertedBatchCount, 1);
assert.equal(mixed.untestedBatchCount, 1);
assert.deepEqual(
  mixed.batches.map((batch) => batch.status),
  ['CONVERTED', 'UNTESTED']
);
assert.deepEqual(mixed.batches[1].archive, batchB.archive);

const replay = factory.manufactureFromArchivedProposals(batchB, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
const replayed = factory.architectureProposalConversion();
assert.equal(replayed.consideredBatchCount, 2);
assert.equal(replayed.replayedBatchCount, 1);
assert.equal(replayed.convertedBatchCount, 1);
assert.equal(replayed.untestedBatchCount, 0);
assert.deepEqual(
  replayed.batches.map((batch) => batch.status),
  ['CONVERTED', 'REPLAYED']
);
assert.equal(replayed.batches[1].replayed, true);
assert.equal(replayed.archivedFingerprintCount, 1);
assert.equal(replayed.convertedFingerprintCount, 1);
assert.equal(replayed.conversionRate, 1);
assert.equal(replay.proposalArchive.sequence, batchB.archive.sequence);
assert.equal(ledger.verify(), true);
assert.equal(
  replayed.batches.every((batch) => Object.hasOwn(batch, 'proposals') === false),
  true
);
assert.equal(
  replayed.batches.every((batch) => Object.hasOwn(batch, 'candidate') === false),
  true
);
assert.equal(
  replayed.batches.every((batch) => Object.hasOwn(batch, 'runner') === false),
  true
);
assert.equal(
  replayed.batches.every((batch) => Object.isFrozen(batch)),
  true
);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_OK batches=${replayed.consideredBatchCount} `
  + `proposals=${replayed.archivedProposalCount} archivedArchitectures=${replayed.archivedFingerprintCount} `
  + `convertedArchitectures=${replayed.convertedFingerprintCount} rate=${replayed.conversionRate} `
  + `replayedBatches=${replayed.replayedBatchCount} convertedBatches=${replayed.convertedBatchCount} `
  + `untestedBatches=${replayed.untestedBatchCount} statuses=${replayed.batches.map((batch) => batch.status).join(',')} `
  + `ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
