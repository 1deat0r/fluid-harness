import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkCampaignReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-campaign-alternate-planner',
  description: 'fresh alternate planner for campaign comparison',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const firstCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-campaign-alpha',
  description: 'first fresh campaign architecture',
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({
    maxEpisodes: 2,
    maxToolCallsPerEpisode: 2
  }),
  components: {
    planner: 'registered-process-planner',
    policy: 'bounded-alpha',
    verifier: 'parent-core'
  }
});
const secondCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-campaign-beta',
  description: 'second fresh campaign architecture',
  plannerCandidate: alternatePlannerCandidate,
  policyFactory: () => new AgentPolicy({
    maxEpisodes: 2,
    maxToolCallsPerEpisode: 2
  }),
  components: {
    planner: 'registered-process-planner',
    policy: 'bounded-beta',
    verifier: 'parent-core'
  }
});
const levels = [
  {
    id: 'campaign-budget-low',
    computeUnits: 1,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  },
  {
    id: 'campaign-budget-high',
    computeUnits: 3,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  }
];
const before = fixture.ledger.serialize();
const campaign = fixture.factory.benchmarkCampaign({
  candidates: [firstCandidate, secondCandidate],
  cases: [fixture.evaluationCase],
  levels
});

assert.equal(isTrustedHarnessFactoryBenchmarkCampaignReport(campaign), true);
assert.equal(Object.isFrozen(campaign), true);
assert.equal(Object.isFrozen(campaign.candidateIds), true);
assert.equal(Object.isFrozen(campaign.points), true);
assert.equal(Object.isFrozen(campaign.points[0]), true);
assert.equal(campaign.candidateCount, 2);
assert.deepEqual(campaign.candidateIds, [firstCandidate.id, secondCandidate.id]);
assert.equal(campaign.caseCount, 1);
assert.equal(campaign.points.length, 4);
assert.equal(campaign.points.every(({ complete }) => complete), true);
assert.equal(campaign.points.every(({ reproducible }) => reproducible), true);
assert.equal(campaign.points.every(({ independent }) => independent), true);
assert.equal(campaign.frontier.length, 2);
assert.deepEqual(
  campaign.frontier.map(({ architectureId, levelId }) => `${architectureId}:${levelId}`),
  [
    `${firstCandidate.id}:campaign-budget-low`,
    `${secondCandidate.id}:campaign-budget-low`
  ]
);
assert.equal(campaign.points.every(({ productionSuccessRate }) => productionSuccessRate === 1), true);
assert.equal(campaign.points.every(({ productionProvenRate }) => productionProvenRate === 1), true);
assert.equal(campaign.points.every(({ dataOnly }) => dataOnly === true), true);
assert.equal(campaign.deployed, false);
assert.equal(campaign.dataOnly, true);
assert.equal(campaign.authorityTransferred, false);
assert.equal(Object.hasOwn(campaign, 'candidate'), false);
assert.equal(Object.hasOwn(campaign, 'candidates'), false);
assert.equal(Object.hasOwn(campaign, 'primary'), false);
assert.equal(Object.hasOwn(campaign, 'reproduction'), false);
assert.equal(Object.hasOwn(campaign, 'reproducibility'), false);
assert.equal(Object.hasOwn(campaign.points[0], 'actionReport'), false);
assert.equal(Object.hasOwn(campaign.points[0], 'runner'), false);
assert.equal(fixture.ledger.serialize(), before);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_OK `
  + `candidates=${campaign.candidateCount} levels=2 points=${campaign.points.length} `
  + `complete=${campaign.complete} reproducible=${campaign.reproducible} `
  + `independent=${campaign.independent} frontier=${campaign.frontier.length} `
  + `ledgerUnchanged=${fixture.ledger.serialize() === before} `
  + `dataOnly=${campaign.dataOnly} authorityTransferred=${campaign.authorityTransferred}`
);
