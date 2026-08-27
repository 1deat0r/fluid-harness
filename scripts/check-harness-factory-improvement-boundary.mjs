import assert from 'node:assert/strict';

import { AgentArchitectureAdoptionAuthority } from '../src/agent-architecture.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-improvement-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
assert.throws(
  () => emptyFixture.factory.improve({
    goal: 'improve without history',
    plannerCandidates: [emptyFixture.plannerCandidate],
    cases: [emptyFixture.evaluationCase],
    ...emptyFixture.budgets
  }),
  /at least one archived factory generation/
);
assert.equal(emptyFixture.ledger.length, 0);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-improvement-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const {
  factory,
  ledger,
  plannerCandidate,
  evaluationCase,
  budgets
} = fixture;
factory.manufacture({
  goal: 'create improvement history',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(ledger.length, 1);

function validImprovementOptions(overrides = {}) {
  return {
    goal: 'bounded improvement boundary check',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    ...overrides
  };
}

assert.throws(
  () => factory.improve(validImprovementOptions({
    memoryQuery: { source: MEMORY_SOURCES.DISTRIBUTION_SHIFT }
  })),
  /must use ARCHITECTURE_DISCOVERY source/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.ARCHITECTURE_DISCOVERY;
  }
});
assert.throws(
  () => factory.improve(validImprovementOptions({ memoryQuery: accessorQuery })),
  /only enumerable data properties/
);
assert.throws(
  () => factory.improve(validImprovementOptions({
    memoryQuery: {
      source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
      actionReport: {}
    }
  })),
  /only enumerable data properties/
);
assert.throws(
  () => factory.improve(validImprovementOptions({
    researchContext: Object.freeze({})
  })),
  /only enumerable data properties/
);
assert.throws(
  () => factory.improve(validImprovementOptions({
    memoryQuery: {
      source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
      keywords: ['not-present']
    }
  })),
  /no archived factory history/
);
assert.throws(
  () => factory.improve(validImprovementOptions({ maxMemoryEntries: 0 })),
  /maxEntries must be a positive integer/
);
assert.equal(ledger.length, 1);

assert.throws(
  () => factory.improve(validImprovementOptions({
    memoryQuery: { keywords: ['adopted'] }
  })),
  /did not strictly improve measured fitness/
);
assert.equal(ledger.length, 2);
assert.deepEqual(
  ledger.records.map((record) => record.kind),
  ['architecture-discovery', 'harness-factory-improvement-rejection']
);

const regressionFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-improvement-regression',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includePartialPlanner: true,
  adoptionAuthority: new AgentArchitectureAdoptionAuthority({
    minimumProductionSuccessRate: 0.5,
    minimumProductionProvenRate: 0.5,
    minimumResearchSuccessRate: 0.5,
    minimumResearchProvenRate: 0.5,
    minimumSkepticSuccessRate: 1,
    minimumTransferSuccessRate: 0.5
  })
});
const regressionBudgets = {
  productionBudget: new EvaluationBudget({ maxCases: 2 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 2 })
};
const baseline = regressionFixture.factory.manufacture({
  goal: 'create a measurable regression baseline',
  plannerCandidates: [regressionFixture.plannerCandidate],
  cases: regressionFixture.evaluationCases,
  ...regressionBudgets
});
assert.equal(baseline.status, 'ADOPTED');
assert.equal(regressionFixture.ledger.length, 1);
const tamperedFactoryMetadata = JSON.parse(regressionFixture.ledger.serialize());
tamperedFactoryMetadata.records[0].payload.factory.dataOnly = false;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedFactoryMetadata)),
  /factory metadata must be data-only/
);
assert.throws(
  () => regressionFixture.factory.improve({
    goal: 'reject a candidate that regresses measured fitness',
    plannerCandidates: [regressionFixture.partialPlannerCandidate],
    cases: regressionFixture.evaluationCases,
    ...regressionBudgets,
    memoryQuery: { keywords: ['adopted'] }
  }),
  /regressed measured fitness/
);
assert.equal(regressionFixture.ledger.length, 2);
assert.equal(
  regressionFixture.factory.improvementRejections().returnedRejectionCount,
  1
);

const driftFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-improvement-drift',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includeFailingPlanner: true
});
driftFixture.factory.manufacture({
  goal: 'create a benchmark contract baseline',
  plannerCandidates: driftFixture.plannerCandidates,
  cases: [driftFixture.evaluationCase],
  ...driftFixture.budgets
});
const changedCase = new AgentPlannerCase({
  id: 'harness-factory-improvement-drift-changed-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-improvement-drift-changed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-improvement-drift-changed-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles[0].action.evidence === 'PROVEN'
    && report.cycles[0].action.result?.path?.join('>') === 'A>B'
});
assert.throws(
  () => driftFixture.factory.improve({
    goal: 'reject an apparent gain on a changed benchmark',
    plannerCandidates: driftFixture.plannerCandidates,
    cases: [changedCase],
    ...driftFixture.budgets,
    memoryQuery: { keywords: ['rejected'] }
  }),
  /benchmark contract changed/
);
assert.equal(driftFixture.ledger.length, 2);
assert.equal(
  driftFixture.factory.improvementRejections().returnedRejectionCount,
  1
);

Object.defineProperty(ledger, 'serialize', {
  configurable: true,
  value: () => '{"format":"fluid-evidence-ledger/v1","records":[]}'
});
assert.throws(
  () => factory.improve(validImprovementOptions()),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_IMPROVEMENT_BOUNDARY_OK `
  + `missingHistoryRejected=true sourceMismatchRejected=true accessorQueryRejected=true `
  + `artifactQueryRejected=true callerContextRejected=true noMatchRejected=true `
  + `capacityRejected=true tamperedLedgerRejected=true sourceFilter=ARCHITECTURE_DISCOVERY `
  + `freshHistoryPreserved=true equalFitnessRejected=true regressionRejected=true `
  + `benchmarkDriftRejected=true factoryMetadataRejected=true authoritySuppressed=true`
);
