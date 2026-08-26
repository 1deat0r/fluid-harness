import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES,
  isTrustedHarnessFactoryBenchmarkFrontierValidationScorecardReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function buildCandidate(fixture, id, plannerCandidate, variant) {
  return new AgentArchitectureCandidate({
    id,
    description: `${id} architecture`,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant }
  });
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-scorecard',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-frontier-validation-scorecard-alternate-planner',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const alpha = buildCandidate(
  fixture,
  'harness-factory-benchmark-frontier-validation-scorecard-alpha',
  fixture.plannerCandidate,
  'alpha'
);
const beta = buildCandidate(
  fixture,
  'harness-factory-benchmark-frontier-validation-scorecard-beta',
  alternatePlannerCandidate,
  'beta'
);
const level = {
  id: 'harness-factory-benchmark-frontier-validation-scorecard-budget',
  computeUnits: 1,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
};
const archivedCampaign = fixture.factory.archiveBenchmarkCampaign(
  fixture.factory.benchmarkCampaign({
    candidates: [alpha, beta],
    cases: [fixture.evaluationCase],
    levels: [level]
  })
);

function validationOptions(candidate) {
  return {
    candidate,
    levelId: level.id,
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase],
    holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

const firstValidation = fixture.factory.validateBenchmarkCampaign(
  archivedCampaign,
  validationOptions(buildCandidate(
    fixture,
    alpha.id,
    fixture.plannerCandidate,
    'alpha'
  ))
);
fixture.factory.archiveBenchmarkCampaignValidation(firstValidation);
const incomplete = fixture.factory.benchmarkFrontierValidationScorecard();
assert.equal(
  isTrustedHarnessFactoryBenchmarkFrontierValidationScorecardReport(incomplete),
  true
);
assert.equal(Object.isFrozen(incomplete), true);
assert.equal(Object.isFrozen(incomplete.batchScores), true);
assert.equal(incomplete.consideredBatchCount, 1);
assert.equal(incomplete.returnedBatchCount, 1);
assert.equal(incomplete.consideredValidationCount, 1);
assert.equal(incomplete.returnedValidationCount, 1);
assert.equal(incomplete.incompleteBatchCount, 1);
assert.equal(incomplete.passedBatchCount, 0);
assert.equal(incomplete.batchScores[0].status, 'INCOMPLETE');
assert.equal(incomplete.batchScores[0].frontierCount, 2);
assert.equal(incomplete.batchScores[0].coveredCount, 1);
assert.equal(incomplete.batchScores[0].frontierCoverageRate, 0.5);
assert.equal(incomplete.batchScores[0].missingPoints.length, 1);
assert.equal(incomplete.batchScores[0].duplicateValidationCount, 0);
assert.equal(incomplete.batchScores[0].complete, false);
assert.equal(incomplete.batchScores[0].dataOnly, true);
assert.equal(incomplete.batchScores[0].authorityTransferred, false);

const secondValidation = fixture.factory.validateBenchmarkCampaign(
  archivedCampaign,
  validationOptions(buildCandidate(
    fixture,
    beta.id,
    alternatePlannerCandidate,
    'beta'
  ))
);
fixture.factory.archiveBenchmarkCampaignValidation(secondValidation);
const scorecard = fixture.factory.benchmarkFrontierValidationScorecard();
const score = scorecard.batchScores[0];
assert.equal(scorecard.consideredValidationCount, 2);
assert.equal(scorecard.returnedValidationCount, 2);
assert.equal(scorecard.completeBatchCount, 1);
assert.equal(scorecard.passedBatchCount, 1);
assert.equal(scorecard.failedBatchCount, 0);
assert.equal(scorecard.incompleteBatchCount, 0);
assert.equal(score.status, HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED);
assert.equal(score.frontierCount, 2);
assert.equal(score.coveredCount, 2);
assert.equal(score.frontierCoverageRate, 1);
assert.equal(score.validationCount, 2);
assert.equal(score.duplicateValidationCount, 0);
assert.equal(score.passedCount, 2);
assert.equal(score.failedCount, 0);
assert.equal(score.passRate, 1);
assert.equal(score.complete, true);
assert.equal(score.reproducible, true);
assert.equal(score.independent, true);
assert.equal(score.missingPoints.length, 0);
assert.equal(score.campaignArchive.sequence, archivedCampaign.archive.sequence);
assert.equal(score.firstValidationArchive.sequence, 2);
assert.equal(score.latestValidationArchive.sequence, 3);
assert.equal(score.dataOnly, true);
assert.equal(score.authorityTransferred, false);
assert.equal(Object.hasOwn(score, 'candidate'), false);
assert.equal(Object.hasOwn(score, 'validations'), false);
assert.equal(Object.isFrozen(score), true);
assert.equal(Object.isFrozen(score.missingPoints), true);
assert.equal(fixture.ledger.length, 3);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_OK `
  + `batches=${scorecard.batchCount} incomplete=${incomplete.batchScores[0].status} `
  + `complete=${score.status} coverage=${score.coveredCount}/${score.frontierCount} `
  + `validations=${score.validationCount} passed=${score.passedCount} `
  + `ledgerEntries=${fixture.ledger.length} dataOnly=${score.dataOnly} `
  + `authorityTransferred=${score.authorityTransferred}`
);
