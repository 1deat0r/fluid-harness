import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES,
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function buildCandidate(id, plannerCandidate, variant) {
  return new AgentArchitectureCandidate({
    id,
    description: `${id} architecture`,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: { variant }
  });
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-memory-improvement',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includeFailingPlanner: true
});
const first = fixture.factory.manufacture({
  goal: 'create a rejected baseline before receipt-memory improvement',
  plannerCandidates: fixture.plannerCandidates,
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
assert.equal(first.status, 'REJECTED');
assert.equal(first.generation, 1);

const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-research-plan-memory-improvement-alternate',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const alpha = buildCandidate(
  'harness-factory-research-plan-memory-improvement-alpha',
  fixture.plannerCandidate,
  'alpha'
);
const beta = buildCandidate(
  'harness-factory-research-plan-memory-improvement-beta',
  alternatePlannerCandidate,
  'beta'
);
const level = {
  id: 'harness-factory-research-plan-memory-improvement-budget',
  computeUnits: 1,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
};
const campaign = fixture.factory.archiveBenchmarkCampaign(
  fixture.factory.benchmarkCampaign({
    candidates: [alpha, beta],
    cases: [fixture.evaluationCase],
    levels: [level]
  })
);
fixture.factory.archiveBenchmarkCampaignValidation(
  fixture.factory.validateBenchmarkCampaign(campaign, {
    candidate: buildCandidate(alpha.id, fixture.plannerCandidate, 'alpha'),
    levelId: level.id,
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  })
);

const plan = fixture.factory.researchPlan().plans.find(
  ({ target }) => target === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
);
assert.notEqual(plan, undefined);
const receipt = fixture.factory.executeResearchPlanReceipt(plan, {
  campaign,
  points: [{
    candidate: buildCandidate(beta.id, alternatePlannerCandidate, 'beta'),
    levelId: level.id
  }],
  cases: [fixture.evaluationCase],
  holdoutCases: [fixture.holdoutCase],
  holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 }),
  archive: true
});
assert.equal(
  receipt.resultType,
  HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.BENCHMARK_FRONTIER_VALIDATION_RESEARCH
);
assert.equal(receipt.resultStatus, 'PASSED');
assert.equal(receipt.targetResolved, true);

const second = fixture.factory.improve({
  goal: 'improve from a successful research-plan receipt',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets,
  memoryQuery: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION,
    keywords: ['status-passed']
  }
});
assert.equal(isTrustedHarnessFactoryReport(second), true);
assert.equal(second.status, 'ADOPTED');
assert.equal(second.generation, 2);
assert.equal(second.improvedFromArchive, true);
assert.equal(second.researchContext.source, 'STRUCTURED_MEMORY');
assert.equal(second.researchContext.query.source, MEMORY_SOURCES.HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION);
assert.equal(second.researchContext.resultCount, 1);
assert.equal(second.improvement.strictlyImproved, true);
assert.equal(second.improvement.nonRegressing, true);
assert.equal(second.improvement.benchmarkStable, true);
assert.equal(second.proposalReport, undefined);

const discoveries = fixture.ledger.restoreArchitectureDiscoveries();
assert.equal(discoveries.length, 2);
assert.equal(
  discoveries[1].proposals[0].components.researchSource,
  'STRUCTURED_MEMORY'
);
assert.equal(discoveries[1].proposals[0].components.priorFactoryResultCount, 1);
assert.equal(fixture.ledger.verify(), true);
assert.equal(second.dataOnly, true);
assert.equal(second.authorityTransferred, false);
assert.equal(Object.hasOwn(second, 'candidate'), false);
assert.equal(Object.hasOwn(second, 'runner'), false);
assert.equal(Object.hasOwn(second, 'actionReport'), false);

console.log(
  `FLUID_HARNESS_FACTORY_RESEARCH_PLAN_MEMORY_IMPROVEMENT_OK `
  + `source=${second.researchContext.query.source} results=${second.researchContext.resultCount} `
  + `first=${first.status} second=${second.status} strict=${second.improvement.strictlyImproved} `
  + `fresh=true authorityTransferred=${second.authorityTransferred}`
);
