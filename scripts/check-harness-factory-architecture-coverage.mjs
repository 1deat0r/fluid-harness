import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryArchitectureCoverageReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-coverage',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

const baseline = factory.manufacture({
  goal: 'create a baseline architecture attempt',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(baseline), true);
assert.equal(baseline.status, 'ADOPTED');

assert.throws(
  () => factory.improve({
    goal: 'repeat an architecture and record its rejected improvement',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    memoryQuery: { keywords: ['adopted'] }
  }),
  /did not strictly improve measured fitness/
);

const coverage = factory.architectureCoverage();
assert.equal(isTrustedHarnessFactoryArchitectureCoverageReport(coverage), true);
assert.equal(coverage.factoryId, factory.factoryId);
assert.equal(coverage.consideredAttemptCount, 2);
assert.equal(coverage.returnedAttemptCount, 2);
assert.equal(coverage.uniqueArchitectureCount, 1);
assert.equal(coverage.novelAttemptCount, 1);
assert.equal(coverage.repeatedAttemptCount, 1);
assert.equal(coverage.unknownArchitectureCount, 0);
assert.equal(coverage.adoptedAttemptCount, 1);
assert.equal(coverage.rejectedAttemptCount, 1);
assert.equal(coverage.truncated, false);
assert.equal(coverage.dataOnly, true);
assert.equal(coverage.authorityTransferred, false);
assert.equal(Object.isFrozen(coverage), true);
assert.deepEqual(
  coverage.attempts.map(({ source, outcome, novel, repeated }) => ({
    source,
    outcome,
    novel,
    repeated
  })),
  [
    { source: 'GENERATION', outcome: 'ADOPTED', novel: true, repeated: false },
    {
      source: 'IMPROVEMENT_REJECTION',
      outcome: 'REJECTED',
      novel: false,
      repeated: true
    }
  ]
);
assert.equal(coverage.attempts.every((attempt) => Object.hasOwn(attempt, 'runner') === false), true);
assert.equal(coverage.attempts.every((attempt) => Object.hasOwn(attempt, 'candidate') === false), true);
assert.equal(coverage.attempts.every((attempt) => Object.hasOwn(attempt, 'actionReport') === false), true);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_OK attempts=${coverage.consideredAttemptCount} `
  + `unique=${coverage.uniqueArchitectureCount} novel=${coverage.novelAttemptCount} `
  + `repeated=${coverage.repeatedAttemptCount} adopted=${coverage.adoptedAttemptCount} `
  + `rejected=${coverage.rejectedAttemptCount} sources=${coverage.attempts.map(({ source }) => source).join(',')} `
  + `dataOnly=${coverage.dataOnly} authorityTransferred=${coverage.authorityTransferred}`
);
