import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function buildCampaign(fixture, prefix) {
  const alternatePlannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-alternate-planner`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
  const makeCandidate = (id, plannerCandidate, variant) => new AgentArchitectureCandidate({
    id,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant }
  });
  return fixture.factory.benchmarkCampaign({
    candidates: [
      makeCandidate(`${prefix}-alpha`, fixture.plannerCandidate, 'alpha'),
      makeCandidate(`${prefix}-beta`, alternatePlannerCandidate, 'beta')
    ],
    cases: [fixture.evaluationCase],
    levels: [{
      id: `${prefix}-budget`,
      computeUnits: 1,
      productionBudget: new EvaluationBudget({ maxCases: 1 }),
      researchBudget: new EvaluationBudget({ maxCases: 1 }),
      skepticBudget: new EvaluationBudget({ maxCases: 1 })
    }]
  });
}

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-memory-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromResearch'
});
assert.throws(
  () => emptyFixture.factory.improve({
    goal: 'reject validation memory without an archived generation',
    plannerCandidates: [emptyFixture.plannerCandidate],
    cases: [emptyFixture.evaluationCase],
    ...emptyFixture.budgets,
    memoryQuery: {
      source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION
    }
  }),
  /at least one archived factory generation/
);
assert.equal(emptyFixture.ledger.length, 0);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-memory-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromResearch',
  includeFailingPlanner: true
});
const first = fixture.factory.manufacture({
  goal: 'create benchmark validation memory boundary baseline',
  plannerCandidates: [fixture.failingPlannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
assert.equal(first.status, 'REJECTED');
const campaign = fixture.factory.archiveBenchmarkCampaign(
  buildCampaign(fixture, 'harness-factory-benchmark-validation-memory-boundary')
);
const validationCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-validation-memory-boundary-alpha',
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const failedHoldoutCase = new AgentPlannerCase({
  id: 'harness-factory-benchmark-validation-memory-boundary-failed-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-validation-memory-boundary-failed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-benchmark-validation-memory-boundary-failed-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: () => false
});
const validation = fixture.factory.validateBenchmarkCampaign(campaign, {
  candidate: validationCandidate,
  levelId: 'harness-factory-benchmark-validation-memory-boundary-budget',
  cases: [fixture.evaluationCase],
  holdoutCases: [failedHoldoutCase]
});
const archivedValidation = fixture.factory.archiveBenchmarkCampaignValidation(validation);
assert.equal(archivedValidation.status, 'FAILED');
assert.equal(archivedValidation.archive.sequence, 3);
const before = fixture.ledger.serialize();

assert.throws(
  () => fixture.factory.improve({
    goal: 'reject an empty benchmark validation-memory query',
    plannerCandidates: [fixture.plannerCandidate],
    cases: [fixture.evaluationCase],
    ...fixture.budgets,
    memoryQuery: {
      source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION,
      keywords: ['not-present']
    }
  }),
  /no archived factory history/
);
assert.equal(fixture.ledger.serialize(), before);

assert.throws(
  () => fixture.factory.improve({
    goal: 'reject an unsupported memory source after validation memory exists',
    plannerCandidates: [fixture.plannerCandidate],
    cases: [fixture.evaluationCase],
    ...fixture.budgets,
    memoryQuery: { source: MEMORY_SOURCES.DISTRIBUTION_SHIFT }
  }),
  /must use ARCHITECTURE_DISCOVERY source/
);
assert.equal(fixture.ledger.serialize(), before);

const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION;
  }
});
assert.throws(
  () => fixture.factory.improve({
    goal: 'reject an accessor benchmark validation-memory query',
    plannerCandidates: [fixture.plannerCandidate],
    cases: [fixture.evaluationCase],
    ...fixture.budgets,
    memoryQuery: accessorQuery
  }),
  /only enumerable data properties/
);
assert.equal(fixture.ledger.serialize(), before);

const tampered = JSON.parse(before);
tampered.records[2].payload.status = 'PASSED';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|source/
);
assert.equal(fixture.ledger.serialize(), before);

Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => before
});
assert.throws(
  () => fixture.factory.improve({
    goal: 'reject mutable ledger benchmark validation memory',
    plannerCandidates: [fixture.plannerCandidate],
    cases: [fixture.evaluationCase],
    ...fixture.budgets,
    memoryQuery: {
      source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION
    }
  }),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_VALIDATION_MEMORY_IMPROVEMENT_BOUNDARY_OK `
  + `noGenerationRejected=true noMatchRejected=true sourceRejected=true `
  + `accessorRejected=true tamperedRejected=true mutableLedgerRejected=true `
  + `ledgerUnchanged=true authoritySuppressed=true`
);
