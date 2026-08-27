import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryImprovementRejectionHistoryReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-improvement-rejection',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

const baseline = factory.manufacture({
  goal: 'create a baseline for rejected improvement evidence',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(baseline), true);
assert.equal(baseline.status, 'ADOPTED');
assert.equal(ledger.length, 1);

assert.throws(
  () => factory.improve({
    goal: 'record an equal-fitness improvement rejection',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    memoryQuery: { keywords: ['adopted'] }
  }),
  /did not strictly improve measured fitness/
);

assert.equal(ledger.length, 2);
assert.deepEqual(
  ledger.records.map((record) => record.kind),
  ['architecture-discovery', 'harness-factory-improvement-rejection']
);
assert.equal(ledger.verify(), true);

const history = factory.improvementRejections();
assert.equal(isTrustedHarnessFactoryImprovementRejectionHistoryReport(history), true);
assert.equal(history.consideredRejectionCount, 1);
assert.equal(history.returnedRejectionCount, 1);
assert.equal(history.truncated, false);
assert.equal(history.complete, true);
const rejection = history.rejections[0];
assert.equal(rejection.attemptedGeneration, 2);
assert.equal(rejection.factoryId, factory.factoryId);
assert.equal(rejection.candidate.adopted, true);
assert.equal(rejection.improvement.accepted, false);
assert.equal(rejection.improvement.strictlyImproved, false);
assert.equal(rejection.reasons.length > 0, true);
assert.equal(rejection.dataOnly, true);
assert.equal(rejection.authorityTransferred, false);
assert.equal(Object.hasOwn(rejection, 'runner'), false);
assert.equal(Object.hasOwn(rejection, 'actionReport'), false);
assert.equal(Object.hasOwn(rejection.candidate, 'candidate'), false);
assert.equal(Object.hasOwn(rejection.candidate, 'runner'), false);
assert.equal(Object.hasOwn(rejection.candidate, 'actionReport'), false);

const generationHistory = factory.history();
assert.equal(generationHistory.returnedGenerationCount, 1);
assert.equal(generationHistory.consideredGenerationCount, 1);
assert.equal(generationHistory.generations[0].generation, 1);

const roundTrip = EvidenceLedger.fromSerialized(ledger.serialize());
assert.equal(roundTrip.verify(), true);
assert.deepEqual(
  roundTrip.restoreHarnessFactoryImprovementRejections(),
  ledger.restoreHarnessFactoryImprovementRejections()
);
assert.deepEqual(
  roundTrip.records.map((record) => record.kind),
  ledger.records.map((record) => record.kind)
);

console.log(
  `FLUID_HARNESS_FACTORY_IMPROVEMENT_REJECTION_OK baseline=${baseline.status} `
  + `rejections=${history.returnedRejectionCount} generations=${generationHistory.returnedGenerationCount} `
  + `strict=${rejection.improvement.strictlyImproved} `
  + `replay=${roundTrip.verify()} dataOnly=${rejection.dataOnly} `
  + `authorityTransferred=${rejection.authorityTransferred}`
);
