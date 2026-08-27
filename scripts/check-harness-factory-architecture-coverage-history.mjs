import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  HarnessFactory,
  MAX_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_ENTRIES,
  isTrustedHarnessFactoryArchitectureCoverageReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-coverage-history',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

factory.manufacture({
  goal: 'create the coverage history baseline',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});

const rejectionCount = MAX_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_ENTRIES + 1;
for (let index = 0; index < rejectionCount; index += 1) {
  assert.throws(
    () => factory.improve({
      goal: `repeat the architecture attempt ${index + 1}`,
      plannerCandidates: [plannerCandidate],
      cases: [evaluationCase],
      ...budgets,
      memoryQuery: { keywords: ['adopted'] }
    }),
    /did not strictly improve measured fitness/
  );
}

const coverage = factory.architectureCoverage();
assert.equal(isTrustedHarnessFactoryArchitectureCoverageReport(coverage), true);
assert.equal(
  coverage.consideredAttemptCount,
  rejectionCount + 1
);
assert.equal(coverage.returnedAttemptCount, coverage.maxEntries);
assert.equal(coverage.maxEntries, MAX_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_ENTRIES);
assert.equal(coverage.truncated, true);
assert.equal(coverage.uniqueArchitectureCount, 1);
assert.equal(coverage.novelAttemptCount, 1);
assert.equal(coverage.repeatedAttemptCount, rejectionCount);
assert.equal(coverage.unknownArchitectureCount, 0);
assert.equal(coverage.adoptedAttemptCount, 1);
assert.equal(coverage.rejectedAttemptCount, rejectionCount);
assert.equal(
  coverage.attempts[0].archive.sequence,
  ledger.records.length - coverage.maxEntries + 1
);
assert.equal(
  coverage.attempts.at(-1).archive.sequence,
  ledger.records.length
);
assert.equal(factory.history().returnedGenerationCount, 1);
assert.equal(ledger.verify(), true);

const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const restoredFactory = new HarnessFactory({
  factoryId: factory.factoryId,
  discoveryRunner: fixture.discoveryRunner,
  ledger: restoredLedger
});
const restoredCoverage = restoredFactory.architectureCoverage();
assert.deepEqual(restoredCoverage, coverage);
assert.equal(restoredLedger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_HISTORY_OK considered=${coverage.consideredAttemptCount} `
  + `returned=${coverage.returnedAttemptCount} max=${coverage.maxEntries} `
  + `truncated=${coverage.truncated} unique=${coverage.uniqueArchitectureCount} `
  + `repeated=${coverage.repeatedAttemptCount} generations=${factory.history().returnedGenerationCount} `
  + `roundTrip=${restoredCoverage.returnedAttemptCount}`
);
