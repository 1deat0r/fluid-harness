import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
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
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
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
  prefix: 'harness-factory-campaign-memory-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromResearch'
});
assert.throws(
  () => emptyFixture.factory.improve({
    goal: 'reject campaign memory without an archived generation',
    plannerCandidates: [emptyFixture.plannerCandidate],
    cases: [emptyFixture.evaluationCase],
    ...emptyFixture.budgets,
    memoryQuery: {
      source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN
    }
  }),
  /at least one archived factory generation/
);
assert.equal(emptyFixture.ledger.length, 0);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-campaign-memory-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromResearch',
  includeFailingPlanner: true
});
const first = fixture.factory.manufacture({
  goal: 'create campaign memory boundary baseline',
  plannerCandidates: [fixture.failingPlannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
assert.equal(first.status, 'REJECTED');
const archivedCampaign = fixture.factory.archiveBenchmarkCampaign(
  buildCampaign(fixture, 'harness-factory-campaign-memory-boundary')
);
assert.equal(archivedCampaign.archive.sequence, 2);
const before = fixture.ledger.serialize();

assert.throws(
  () => fixture.factory.improve({
    goal: 'reject an empty campaign-memory query',
    plannerCandidates: [fixture.plannerCandidate],
    cases: [fixture.evaluationCase],
    ...fixture.budgets,
    memoryQuery: {
      source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN,
      keywords: ['not-present']
    }
  }),
  /no archived factory history/
);
assert.equal(fixture.ledger.serialize(), before);

assert.throws(
  () => fixture.factory.improve({
    goal: 'reject an unsupported memory source',
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
    return MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN;
  }
});
assert.throws(
  () => fixture.factory.improve({
    goal: 'reject an accessor campaign-memory query',
    plannerCandidates: [fixture.plannerCandidate],
    cases: [fixture.evaluationCase],
    ...fixture.budgets,
    memoryQuery: accessorQuery
  }),
  /only enumerable data properties/
);
assert.equal(fixture.ledger.serialize(), before);

const tampered = JSON.parse(before);
tampered.records[1].payload.points[0].productionSuccessRate = 0;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|Pareto|frontier/
);
assert.equal(fixture.ledger.serialize(), before);

Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => before
});
assert.throws(
  () => fixture.factory.improve({
    goal: 'reject mutable ledger campaign memory',
    plannerCandidates: [fixture.plannerCandidate],
    cases: [fixture.evaluationCase],
    ...fixture.budgets,
    memoryQuery: {
      source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN
    }
  }),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_CAMPAIGN_MEMORY_IMPROVEMENT_BOUNDARY_OK `
  + `noGenerationRejected=true noMatchRejected=true sourceRejected=true `
  + `accessorRejected=true tamperedRejected=true mutableLedgerRejected=true `
  + `ledgerUnchanged=true authoritySuppressed=true`
);
