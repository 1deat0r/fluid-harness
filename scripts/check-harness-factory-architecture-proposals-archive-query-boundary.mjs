import assert from 'node:assert/strict';

import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-archive-query-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

factory.manufacture({
  goal: 'create history for archive-query boundary checks',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.throws(
  () => factory.improve({
    goal: 'create rejection history for archive-query capacity checks',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    memoryQuery: {
      source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
      keywords: ['adopted']
    }
  }),
  /did not strictly improve measured fitness/
);
const beforeLedger = ledger.serialize();

assert.throws(
  () => factory.proposeArchitectures({
    goal: 'unsupported archive source',
    plannerCandidates: [plannerCandidate],
    memoryQuery: { source: MEMORY_SOURCES.DISTRIBUTION_SHIFT }
  }),
  /source is unsupported/
);
assert.throws(
  () => factory.proposeArchitectures({
    goal: 'empty archive sources',
    plannerCandidates: [plannerCandidate],
    memoryQuery: { sources: [] }
  }),
  /unique supported sources/
);
assert.throws(
  () => factory.proposeArchitectures({
    goal: 'duplicate archive sources',
    plannerCandidates: [plannerCandidate],
    memoryQuery: {
      sources: [
        MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
        MEMORY_SOURCES.ARCHITECTURE_DISCOVERY
      ]
    }
  }),
  /unique supported sources/
);

const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.ARCHITECTURE_DISCOVERY;
  }
});
assert.throws(
  () => factory.proposeArchitectures({
    goal: 'accessor archive query',
    plannerCandidates: [plannerCandidate],
    memoryQuery: accessorQuery
  }),
  /only enumerable data properties/
);

assert.throws(
  () => factory.proposeArchitectures({
    goal: 'no matching archive history',
    plannerCandidates: [plannerCandidate],
    memoryQuery: {
      source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
      keywords: ['archive-keyword-that-does-not-exist']
    }
  }),
  /found no matching archive history/
);

assert.throws(
  () => factory.proposeArchitectures({
    goal: 'archive memory capacity overflow',
    plannerCandidates: [plannerCandidate],
    maxMemoryEntries: 1,
    memoryQuery: {
      sources: [
        MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
        MEMORY_SOURCES.HARNESS_FACTORY_IMPROVEMENT_REJECTION
      ]
    }
  }),
  /exceeds remaining capacity/
);

assert.deepEqual(ledger.serialize(), beforeLedger);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_ARCHIVE_QUERY_BOUNDARY_OK `
  + `unsupportedRejected=true emptyRejected=true duplicateRejected=true `
  + `accessorRejected=true noMatchRejected=true capacityRejected=true `
  + `ledgerPreserved=${ledger.verify()}`
);
