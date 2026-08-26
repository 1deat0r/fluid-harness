import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import {
  isTrustedHarnessFactoryBenchmarkValidationScorecardReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-scorecard-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyScorecard = emptyFixture.factory.benchmarkValidationScorecard();
assert.equal(isTrustedHarnessFactoryBenchmarkValidationScorecardReport(emptyScorecard), true);
assert.equal(Object.isFrozen(emptyScorecard), true);
assert.equal(emptyScorecard.consideredValidationCount, 0);
assert.equal(emptyScorecard.returnedValidationCount, 0);
assert.equal(emptyScorecard.candidateCount, 0);
assert.equal(emptyScorecard.truncated, false);
assert.deepEqual(emptyScorecard.candidateScores, []);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-scorecard',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-validation-scorecard-alternate-planner',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const firstCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-validation-scorecard-alpha',
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const secondCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-validation-scorecard-beta',
  plannerCandidate: alternatePlannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'beta' }
});
const level = {
  id: 'scorecard-budget',
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
  id: 'harness-factory-benchmark-validation-scorecard-failed-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-validation-scorecard-failed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-benchmark-validation-scorecard-failed-task',
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

const beforeScorecard = fixture.ledger.serialize();
const scorecard = fixture.factory.benchmarkValidationScorecard();
const score = scorecard.candidateScores[0];
assert.equal(isTrustedHarnessFactoryBenchmarkValidationScorecardReport(scorecard), true);
assert.equal(Object.isFrozen(scorecard), true);
assert.equal(Object.isFrozen(scorecard.candidateScores), true);
assert.equal(scorecard.factoryId, fixture.factory.factoryId);
assert.equal(scorecard.consideredValidationCount, 33);
assert.equal(scorecard.returnedValidationCount, 32);
assert.equal(scorecard.candidateCount, 1);
assert.equal(scorecard.maxEntries, 32);
assert.equal(scorecard.truncated, true);
assert.equal(Object.isFrozen(score), true);
assert.equal(score.candidateId, firstCandidate.id);
assert.equal(score.validationCount, 32);
assert.equal(score.passedCount, 31);
assert.equal(score.failedCount, 1);
assert.equal(score.passRate, 31 / 32);
assert.equal(score.completeCount, 32);
assert.equal(score.reproducibleCount, 32);
assert.equal(score.independentCount, 32);
assert.equal(score.latestStatus, 'PASSED');
assert.equal(score.latestLevelId, level.id);
assert.equal(score.latestArchive.sequence, 34);
assert.equal(score.latestCampaignArchive.sequence, archivedCampaign.archive.sequence);
assert.equal(score.dataOnly, true);
assert.equal(score.authorityTransferred, false);
assert.equal(Object.hasOwn(score, 'candidate'), false);
assert.equal(Object.hasOwn(score, 'candidates'), false);
assert.equal(Object.hasOwn(score, 'runner'), false);
assert.equal(Object.hasOwn(score, 'actionReport'), false);
assert.equal(Object.hasOwn(score, 'holdout'), false);
assert.equal(archivedFailed.status, 'FAILED');
assert.equal(scorecard.dataOnly, true);
assert.equal(scorecard.authorityTransferred, false);
assert.equal(fixture.ledger.serialize(), beforeScorecard);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_VALIDATION_SCORECARD_OK `
  + `considered=${scorecard.consideredValidationCount} `
  + `returned=${scorecard.returnedValidationCount} candidates=${scorecard.candidateCount} `
  + `passRate=${score.passRate} latest=${score.latestStatus} `
  + `ledgerUnchanged=${fixture.ledger.serialize() === beforeScorecard} `
  + `dataOnly=${scorecard.dataOnly} authorityTransferred=${scorecard.authorityTransferred}`
);
