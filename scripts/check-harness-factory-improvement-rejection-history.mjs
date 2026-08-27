import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  MAX_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORY_ENTRIES
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-improvement-rejection-history',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

factory.manufacture({
  goal: 'create a bounded rejection history baseline',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});

const rejectionCount = MAX_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORY_ENTRIES + 1;
for (let index = 0; index < rejectionCount; index += 1) {
  assert.throws(
    () => factory.improve({
      goal: `record rejection ${index + 1}`,
      plannerCandidates: [plannerCandidate],
      cases: [evaluationCase],
      ...budgets,
      memoryQuery: { keywords: ['adopted'] }
    }),
    /did not strictly improve measured fitness/
  );
}

const history = factory.improvementRejections();
assert.equal(history.consideredRejectionCount, rejectionCount);
assert.equal(
  history.returnedRejectionCount,
  MAX_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORY_ENTRIES
);
assert.equal(history.truncated, true);
assert.equal(history.complete, false);
assert.equal(history.rejections.length, history.maxEntries);
assert.equal(
  history.rejections[0].archive.sequence,
  ledger.records.length - history.maxEntries + 1
);
assert.equal(
  history.rejections[history.rejections.length - 1].archive.sequence,
  ledger.records.length
);
assert.equal(factory.history().returnedGenerationCount, 1);
assert.equal(ledger.verify(), true);

const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const restored = restoredLedger.restoreHarnessFactoryImprovementRejections();
assert.equal(restored.length, rejectionCount);
assert.deepEqual(
  restored.slice(-history.maxEntries),
  history.rejections
);
assert.equal(
  restored.every((rejection) => rejection.dataOnly === true
    && rejection.authorityTransferred === false
    && Object.hasOwn(rejection, 'runner') === false),
  true
);

console.log(
  `FLUID_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORY_OK considered=${history.consideredRejectionCount} `
  + `returned=${history.returnedRejectionCount} max=${history.maxEntries} `
  + `truncated=${history.truncated} generations=${factory.history().returnedGenerationCount} `
  + `roundTrip=${restored.length}`
);
