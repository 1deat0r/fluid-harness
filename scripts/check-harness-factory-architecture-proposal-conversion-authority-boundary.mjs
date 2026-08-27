import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryArchitectureProposalConversionReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-conversion-authority-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

const archived = factory.proposeArchitectures({
  goal: 'archive a batch whose conversion must stay advisory',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const generation = factory.manufacture({
  goal: 'evaluate the archived architecture through the ordinary lifecycle',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(generation), true);

const viewBefore = factory.architectureProposalConversion();
assert.equal(viewBefore.convertedFingerprintCount, 1);
assert.equal(viewBefore.conversionRate, 1);
const beforeLedger = ledger.serialize();
const viewAfter = factory.architectureProposalConversion();
assert.deepEqual(
  {
    consideredBatchCount: viewAfter.consideredBatchCount,
    convertedFingerprintCount: viewAfter.convertedFingerprintCount,
    conversionRate: viewAfter.conversionRate
  },
  {
    consideredBatchCount: viewBefore.consideredBatchCount,
    convertedFingerprintCount: viewBefore.convertedFingerprintCount,
    conversionRate: viewBefore.conversionRate
  }
);
assert.deepEqual(ledger.serialize(), beforeLedger);

const restored = ledger.restoreHarnessFactoryArchitectureProposals();
assert.equal(restored.length, 1);
assert.equal(restored[0].evaluated, false);
assert.equal(restored[0].adopted, false);
assert.equal(restored[0].deployed, false);
assert.equal(restored[0].dataOnly, true);
assert.equal(restored[0].authorityTransferred, false);
assert.deepEqual(restored[0].archive, archived.archive);

assert.throws(
  () => factory.manufactureFromArchivedProposals(viewAfter, {
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets
  }),
  /requires an exact archived report from this factory/
);
const forged = { ...viewAfter, batches: [{ ...viewAfter.batches[0], replayed: true }] };
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalConversionReport(forged),
  false
);
const accessorBearing = Object.create(
  Object.getPrototypeOf(viewAfter)
);
Object.defineProperty(accessorBearing, 'consideredBatchCount', {
  enumerable: true,
  get() {
    return 99;
  }
});
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalConversionReport(accessorBearing),
  false
);
assert.equal(ledger.verify(), true);
assert.deepEqual(ledger.serialize(), beforeLedger);

const generationsBefore = factory.history().generations.length;
assert.throws(
  () => factory.improve({
    goal: 'conversion memory must not substitute for a measured strict gain',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    memoryQuery: {
      source: MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION,
      keywords: ['harness-factory-proposal-conversion']
    }
  }),
  /did not strictly improve/
);
assert.equal(factory.history().generations.length, generationsBefore);
assert.equal(ledger.verify(), true);
const rejections = factory.improvementRejections();
assert.equal(rejections.rejections.length, 1);
assert.equal(rejections.rejections[0].dataOnly, true);
assert.equal(rejections.rejections[0].authorityTransferred, false);

const replay = factory.manufactureFromArchivedProposals(archived, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(replay), true);
assert.equal(replay.freshAdoption, true);
assert.equal(replay.deployed, false);
assert.equal(replay.authorityTransferred, false);
const replayedView = factory.architectureProposalConversion();
assert.equal(replayedView.replayedBatchCount, 1);
assert.equal(replayedView.batches[0].status, 'REPLAYED');
const replayRestored = ledger.restoreHarnessFactoryArchitectureProposals();
assert.equal(replayRestored[0].evaluated, false);
assert.equal(replayRestored[0].adopted, false);
assert.equal(replayRestored[0].deployed, false);
assert.equal(factory.history().generations.length, 2);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_AUTHORITY_BOUNDARY_OK `
  + `sourceEvaluated=${replayRestored[0].evaluated} sourceAdopted=${replayRestored[0].adopted} `
  + `sourceDeployed=${replayRestored[0].deployed} sourceDataOnly=${replayRestored[0].dataOnly} `
  + `forgedRejected=${!isTrustedHarnessFactoryArchitectureProposalConversionReport(forged)} `
  + `accessorRejected=${!isTrustedHarnessFactoryArchitectureProposalConversionReport(accessorBearing)} `
  + `bridgeRejected=true strictGainRequired=true rejections=${rejections.rejections.length} `
  + `freshAdopted=${replay.adoptedCandidateId !== null} replayedBatches=${replayedView.replayedBatchCount} `
  + `generations=${factory.history().generations.length} ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
