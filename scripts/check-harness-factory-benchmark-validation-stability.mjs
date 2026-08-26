import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES,
  isTrustedHarnessFactoryBenchmarkValidationStabilityReport
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
  prefix: 'harness-factory-benchmark-validation-stability',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-validation-stability-alternate-planner',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const alpha = buildCandidate(
  fixture,
  'harness-factory-benchmark-validation-stability-alpha',
  fixture.plannerCandidate,
  'alpha'
);
const beta = buildCandidate(
  fixture,
  'harness-factory-benchmark-validation-stability-beta',
  alternatePlannerCandidate,
  'beta'
);
const level = {
  id: 'harness-factory-benchmark-validation-stability-budget',
  computeUnits: 1,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
};
const firstCampaign = fixture.factory.archiveBenchmarkCampaign(
  fixture.factory.benchmarkCampaign({
    candidates: [alpha, beta],
    cases: [fixture.evaluationCase],
    levels: [level]
  })
);
const secondCampaign = fixture.factory.archiveBenchmarkCampaign(
  fixture.factory.benchmarkCampaign({
    candidates: [alpha, beta],
    cases: [fixture.evaluationCase],
    levels: [level]
  })
);

function validate(candidate, campaign, holdoutCases) {
  const validation = fixture.factory.validateBenchmarkCampaign(campaign, {
    candidate: buildCandidate(
      fixture,
      candidate.id,
      candidate.plannerCandidate,
      candidate.components.variant
    ),
    levelId: level.id,
    cases: [fixture.evaluationCase],
    holdoutCases
  });
  return fixture.factory.archiveBenchmarkCampaignValidation(validation);
}

const alphaFirst = validate(alpha, firstCampaign, [fixture.holdoutCase]);
const alphaSecond = validate(alpha, secondCampaign, [fixture.holdoutCase]);
const failedHoldout = new AgentPlannerCase({
  id: 'harness-factory-benchmark-validation-stability-failed-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-validation-stability-failed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-benchmark-validation-stability-failed-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: () => false
});
const betaFailed = validate(beta, firstCampaign, [failedHoldout]);
assert.equal(alphaFirst.status, 'PASSED');
assert.equal(alphaSecond.status, 'PASSED');
assert.equal(betaFailed.status, 'FAILED');

const before = fixture.ledger.serialize();
const stability = fixture.factory.benchmarkValidationStability();
assert.equal(isTrustedHarnessFactoryBenchmarkValidationStabilityReport(stability), true);
assert.equal(Object.isFrozen(stability), true);
assert.equal(Object.isFrozen(stability.candidateScores), true);
assert.equal(stability.consideredValidationCount, 3);
assert.equal(stability.returnedValidationCount, 3);
assert.equal(stability.candidateCount, 2);
assert.equal(stability.stableCandidateCount, 1);
assert.equal(stability.truncated, false);
assert.equal(stability.candidateScores[0].candidateId, alpha.id);
assert.equal(
  stability.candidateScores[0].stabilityStatus,
  HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES.STABLE
);
assert.equal(stability.candidateScores[0].stable, true);
assert.equal(stability.candidateScores[0].validationCount, 2);
assert.equal(stability.candidateScores[0].campaignCount, 2);
assert.equal(stability.candidateScores[0].passedCount, 2);
assert.equal(stability.candidateScores[0].failedCount, 0);
assert.equal(stability.candidateScores[0].passRate, 1);
assert.equal(stability.candidateScores[0].firstCampaignArchive.sequence, firstCampaign.archive.sequence);
assert.equal(stability.candidateScores[0].latestCampaignArchive.sequence, secondCampaign.archive.sequence);
assert.equal(stability.candidateScores[1].candidateId, beta.id);
assert.equal(
  stability.candidateScores[1].stabilityStatus,
  HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
);
assert.equal(stability.candidateScores[1].stable, false);
assert.equal(stability.candidateScores[1].campaignCount, 1);
assert.equal(stability.candidateScores[1].passRate, 0);
assert.equal(stability.candidateScores[1].latestStatus, 'FAILED');
assert.equal(stability.dataOnly, true);
assert.equal(stability.authorityTransferred, false);
assert.equal(Object.hasOwn(stability.candidateScores[0], 'candidate'), false);
assert.equal(Object.hasOwn(stability.candidateScores[0], 'holdout'), false);
assert.equal(fixture.ledger.serialize(), before);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_OK `
  + `validations=${stability.consideredValidationCount} candidates=${stability.candidateCount} `
  + `stable=${stability.stableCandidateCount} primary=${stability.candidateScores[0].stabilityStatus} `
  + `primaryCampaigns=${stability.candidateScores[0].campaignCount} `
  + `oneOff=${stability.candidateScores[1].stabilityStatus} `
  + `ledgerUnchanged=${fixture.ledger.serialize() === before} dataOnly=${stability.dataOnly} `
  + `authorityTransferred=${stability.authorityTransferred}`
);
