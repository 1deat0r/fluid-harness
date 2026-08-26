import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import {
  isTrustedHarnessFactoryBenchmarkCampaignValidationReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-validation',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-campaign-validation-alternate-planner',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const firstCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-campaign-validation-alpha',
  description: 'first validation campaign architecture',
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const secondCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-campaign-validation-beta',
  description: 'second validation campaign architecture',
  plannerCandidate: alternatePlannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'beta' }
});
const level = {
  id: 'validation-campaign-budget',
  computeUnits: 1,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
};
const campaign = fixture.factory.benchmarkCampaign({
  candidates: [firstCandidate, secondCandidate],
  cases: [fixture.evaluationCase],
  levels: [level]
});
const archived = fixture.factory.archiveBenchmarkCampaign(campaign);
const before = fixture.ledger.serialize();

function matchingCandidate() {
  return new AgentArchitectureCandidate({
    id: firstCandidate.id,
    description: firstCandidate.description,
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant: 'alpha' }
  });
}

const passed = fixture.factory.validateBenchmarkCampaign(archived, {
  candidate: matchingCandidate(),
  levelId: level.id,
  cases: [fixture.evaluationCase],
  holdoutCases: [fixture.holdoutCase],
  holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(isTrustedHarnessFactoryBenchmarkCampaignValidationReport(passed), true);
assert.equal(Object.isFrozen(passed), true);
assert.equal(Object.isFrozen(passed.campaignArchive), true);
assert.equal(Object.isFrozen(passed.campaignPoint), true);
assert.equal(Object.isFrozen(passed.benchmarkPoint), true);
assert.equal(passed.campaignArchive.sequence, archived.archive.sequence);
assert.equal(passed.candidateId, firstCandidate.id);
assert.equal(passed.levelId, level.id);
assert.equal(passed.benchmarkMatch, true);
assert.equal(passed.holdout.passed, true);
assert.equal(passed.status, 'PASSED');
assert.equal(passed.passed, true);
assert.equal(passed.complete, true);
assert.equal(passed.reproducible, true);
assert.equal(passed.independent, true);
assert.equal(passed.archived, false);
assert.equal(passed.archive, null);
assert.equal(passed.deployed, false);
assert.equal(passed.dataOnly, true);
assert.equal(passed.authorityTransferred, false);
assert.equal(Object.hasOwn(passed, 'candidate'), false);
assert.equal(Object.hasOwn(passed, 'primary'), false);
assert.equal(Object.hasOwn(passed, 'reproduction'), false);
assert.equal(Object.hasOwn(passed, 'runner'), false);

const failedHoldoutCase = new AgentPlannerCase({
  id: 'harness-factory-benchmark-campaign-validation-failing-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-campaign-validation-failing-holdout-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-benchmark-campaign-validation-failing-holdout-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: () => false
});
const failed = fixture.factory.validateBenchmarkCampaign(archived, {
  candidate: matchingCandidate(),
  levelId: level.id,
  cases: [fixture.evaluationCase],
  holdoutCases: [failedHoldoutCase]
});

assert.equal(isTrustedHarnessFactoryBenchmarkCampaignValidationReport(failed), true);
assert.equal(failed.benchmarkMatch, true);
assert.equal(failed.holdout.passed, false);
assert.equal(failed.status, 'FAILED');
assert.equal(failed.passed, false);
assert.equal(failed.complete, true);
assert.equal(failed.reproducible, true);
assert.equal(failed.independent, true);
assert.equal(fixture.ledger.serialize(), before);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_OK `
  + `campaign=${passed.campaignArchive.sequence} candidate=${passed.candidateId} `
  + `level=${passed.levelId} benchmarkMatch=${passed.benchmarkMatch} `
  + `passed=${passed.status} failed=${failed.status} `
  + `holdoutCases=${passed.holdoutCaseIds.length} ledgerUnchanged=${fixture.ledger.serialize() === before} `
  + `dataOnly=${passed.dataOnly} authorityTransferred=${passed.authorityTransferred}`
);
