import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import {
  isTrustedHarnessFactoryBenchmarkCampaignValidationHistoryReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-validation-history',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-campaign-validation-history-alternate-planner',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const firstCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-campaign-validation-history-alpha',
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const secondCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-campaign-validation-history-beta',
  plannerCandidate: alternatePlannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'beta' }
});
const level = {
  id: 'validation-history-budget',
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
const archivedCampaign = fixture.factory.archiveBenchmarkCampaign(campaign);

function matchingCandidate() {
  return new AgentArchitectureCandidate({
    id: firstCandidate.id,
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant: 'alpha' }
  });
}

const passingValidation = fixture.factory.validateBenchmarkCampaign(archivedCampaign, {
  candidate: matchingCandidate(),
  levelId: level.id,
  cases: [fixture.evaluationCase],
  holdoutCases: [fixture.holdoutCase]
});
const archivedPassing = fixture.factory.archiveBenchmarkCampaignValidation(
  passingValidation
);

const failedHoldoutCase = new AgentPlannerCase({
  id: 'harness-factory-benchmark-campaign-validation-history-failed-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-campaign-validation-history-failed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-benchmark-campaign-validation-history-failed-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: () => false
});
const failedValidation = fixture.factory.validateBenchmarkCampaign(archivedCampaign, {
  candidate: matchingCandidate(),
  levelId: level.id,
  cases: [fixture.evaluationCase],
  holdoutCases: [failedHoldoutCase]
});
const archivedFailed = fixture.factory.archiveBenchmarkCampaignValidation(
  failedValidation
);

for (let index = 2; index < 33; index += 1) {
  fixture.ledger.appendHarnessFactoryBenchmarkValidation(archivedPassing);
}

const beforeHistory = fixture.ledger.serialize();
const history = fixture.factory.benchmarkCampaignValidations();

assert.equal(
  isTrustedHarnessFactoryBenchmarkCampaignValidationHistoryReport(history),
  true
);
assert.equal(Object.isFrozen(history), true);
assert.equal(Object.isFrozen(history.validations), true);
assert.equal(history.factoryId, fixture.factory.factoryId);
assert.equal(history.consideredValidationCount, 33);
assert.equal(history.returnedValidationCount, 32);
assert.equal(history.maxEntries, 32);
assert.equal(history.truncated, true);
assert.equal(Object.isFrozen(history.validations[0]), true);
assert.equal(Object.isFrozen(history.validations[0].archive), true);
assert.equal(Object.isFrozen(history.validations[0].campaignPoint), true);
assert.equal(Object.isFrozen(history.validations[0].benchmarkPoint), true);
assert.equal(Object.isFrozen(history.validations[0].holdout), true);
assert.equal(history.validations[0].factoryId, fixture.factory.factoryId);
assert.equal(history.validations[0].archive.sequence, archivedFailed.archive.sequence);
assert.equal(
  history.validations[history.validations.length - 1].archive.sequence,
  34
);
assert.equal(history.validations[0].status, 'FAILED');
assert.equal(history.validations[1].status, 'PASSED');
assert.equal(history.validations[0].dataOnly, true);
assert.equal(history.validations[0].deployed, false);
assert.equal(history.validations[0].authorityTransferred, false);
assert.equal(Object.hasOwn(history.validations[0], 'candidate'), false);
assert.equal(Object.hasOwn(history.validations[0], 'candidates'), false);
assert.equal(Object.hasOwn(history.validations[0], 'primary'), false);
assert.equal(Object.hasOwn(history.validations[0], 'reproduction'), false);
assert.equal(Object.hasOwn(history.validations[0], 'runner'), false);
assert.equal(Object.hasOwn(history.validations[0], 'actionReport'), false);
assert.equal(Object.hasOwn(history.validations[0].campaignPoint, 'actionReport'), false);
assert.equal(Object.hasOwn(history.validations[0].benchmarkPoint, 'runner'), false);
assert.equal(Object.hasOwn(history.validations[0].holdout, 'candidate'), false);
assert.equal(history.dataOnly, true);
assert.equal(history.authorityTransferred, false);
assert.equal(fixture.ledger.serialize(), beforeHistory);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_HISTORY_OK `
  + `considered=${history.consideredValidationCount} `
  + `returned=${history.returnedValidationCount} truncated=${history.truncated} `
  + `sequence=${history.validations[0].archive.sequence}-`
  + `${history.validations[history.validations.length - 1].archive.sequence} `
  + `statuses=${history.validations[0].status},${history.validations[1].status} `
  + `ledgerUnchanged=${fixture.ledger.serialize() === beforeHistory} `
  + `dataOnly=${history.dataOnly} authorityTransferred=${history.authorityTransferred}`
);
