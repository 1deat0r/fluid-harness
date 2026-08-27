import assert from 'node:assert/strict';

import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-multi-source-improvement-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const {
  factory,
  ledger,
  plannerCandidate,
  evaluationCase,
  budgets
} = fixture;
const baseline = factory.manufacture({
  goal: 'create a multi-source improvement boundary baseline',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(baseline.status, 'ADOPTED');
const initialLength = ledger.length;
const initialSerialization = ledger.serialize();

function validImprovementOptions(overrides = {}) {
  return {
    goal: 'bounded multi-source improvement boundary check',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    ...overrides
  };
}

assert.throws(
  () => factory.improve(validImprovementOptions({
    memoryQuery: { sources: [] }
  })),
  /sources must contain unique supported sources/
);
assert.throws(
  () => factory.improve(validImprovementOptions({
    memoryQuery: {
      sources: [
        MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
        MEMORY_SOURCES.ARCHITECTURE_DISCOVERY
      ]
    }
  })),
  /sources must contain unique supported sources/
);
assert.throws(
  () => factory.improve(validImprovementOptions({
    memoryQuery: { sources: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY }
  })),
  /sources must contain unique supported sources/
);
assert.throws(
  () => factory.improve(validImprovementOptions({
    memoryQuery: { sources: [MEMORY_SOURCES.DISTRIBUTION_SHIFT] }
  })),
  /sources must contain unique supported sources/
);
assert.throws(
  () => factory.improve(validImprovementOptions({
    memoryQuery: {
      source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
      sources: [MEMORY_SOURCES.HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION]
    }
  })),
  /cannot use source and sources together/
);

const accessorSources = [];
Object.defineProperty(accessorSources, '0', {
  enumerable: true,
  configurable: true,
  get() {
    throw new Error('source accessor should not be read');
  }
});
assert.throws(
  () => factory.improve(validImprovementOptions({
    memoryQuery: { sources: accessorSources }
  })),
  /enumerable data properties only/
);
assert.throws(
  () => factory.improve(validImprovementOptions({
    memoryQuery: {
      sources: [MEMORY_SOURCES.ARCHITECTURE_DISCOVERY],
      actionReport: {}
    }
  })),
  /only enumerable data properties/
);

assert.equal(ledger.length, initialLength);
assert.equal(ledger.serialize(), initialSerialization);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_MULTI_SOURCE_IMPROVEMENT_BOUNDARY_OK `
  + `emptyRejected=true duplicateRejected=true scalarRejected=true `
  + `unsupportedRejected=true conflictRejected=true accessorRejected=true `
  + `authorityRejected=true ledgerUnchanged=${ledger.length === initialLength} `
  + 'authorityTransferred=false'
);
