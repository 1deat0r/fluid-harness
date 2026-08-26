import assert from 'node:assert/strict';

import { isTrustedHarnessFactoryHistoryReport } from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-partition-improvement-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includeFailingPlanner: true
});
const {
  factory,
  ledger,
  plannerCandidates,
  evaluationCase,
  holdoutCase,
  budgets
} = fixture;

factory.manufacture({
  goal: 'create a rejected baseline for selector validation',
  plannerCandidates,
  cases: [evaluationCase],
  ...budgets
});
factory.manufacture({
  goal: 'create a newer benchmark generation for selector validation',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [holdoutCase],
  ...budgets
});
const initialLedgerLength = ledger.length;
const history = factory.history();
assert.equal(isTrustedHarnessFactoryHistoryReport(history), true);
assert.equal(Object.isFrozen(history.generations[0].architecture), true);
assert.equal(Object.isFrozen(history.generations[0].architecture.components), true);
assert.equal(Object.hasOwn(history.generations[0].architecture, 'plannerFactory'), false);
assert.equal(Object.hasOwn(history.generations[0].architecture, 'policyFactory'), false);
assert.equal(Object.hasOwn(history.generations[0].architecture, 'candidate'), false);
assert.throws(
  () => {
    history.generations[0].architecture.components.tampered = true;
  },
  TypeError
);
const forgedHistory = Object.freeze({ ...history });
assert.equal(isTrustedHarnessFactoryHistoryReport(forgedHistory), false);

const validOptions = (overrides = {}) => ({
  goal: 'attempt an explicitly selected factory improvement',
  plannerCandidates,
  cases: [evaluationCase],
  ...budgets,
  baselineGeneration: 1,
  memoryQuery: {
    source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
    keywords: ['rejected']
  },
  ...overrides
});

const expectRejected = (overrides, pattern) => {
  assert.throws(
    () => factory.improve(validOptions(overrides)),
    pattern
  );
  assert.equal(ledger.length, initialLedgerLength);
  assert.equal(ledger.verify(), true);
};

expectRejected(
  { baselineGeneration: 0 },
  /baselineGeneration must be null or a positive safe integer/
);
expectRejected(
  { baselineGeneration: -1 },
  /baselineGeneration must be null or a positive safe integer/
);
expectRejected(
  { baselineGeneration: 1.5 },
  /baselineGeneration must be null or a positive safe integer/
);
expectRejected(
  { baselineGeneration: '1' },
  /baselineGeneration must be null or a positive safe integer/
);
expectRejected(
  { baselineGeneration: 99 },
  /baselineGeneration 99 does not identify an archived factory generation/
);
expectRejected(
  {
    memoryQuery: {
      source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
      taskId: 'architecture-discovery:999'
    }
  },
  /taskId must match the selected baseline/
);
expectRejected(
  {
    memoryQuery: {
      source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
      keywords: Array.from({ length: 17 }, (_, index) => `keyword-${index}`)
    }
  },
  /cannot contain more than 16/
);
expectRejected(
  {
    memoryQuery: {
      source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
      keywords: 'not-an-array'
    }
  },
  /must be an array/
);

const accessorOptions = validOptions();
Object.defineProperty(accessorOptions, 'baselineGeneration', {
  configurable: true,
  enumerable: true,
  get() {
    return 1;
  }
});
assert.throws(
  () => factory.improve(accessorOptions),
  /enumerable data properties/
);
assert.equal(ledger.length, initialLedgerLength);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_PARTITION_IMPROVEMENT_BOUNDARY_OK `
  + `malformedRejected=true accessorRejected=true missingRejected=true `
  + `outOfRangeRejected=true scopedQueryRejected=true keywordCapacityRejected=true `
  + `keywordShapeRejected=true ledgerUnchanged=${ledger.length === initialLedgerLength} `
  + `historyConfigSummary=true forgedHistoryRejected=true mutableConfigRejected=true `
  + `authoritySuppressed=true`
);
