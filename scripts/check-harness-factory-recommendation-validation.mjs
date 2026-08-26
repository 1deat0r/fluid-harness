import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_HOLDOUT_STATUSES,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES,
  isTrustedHarnessFactoryValidationReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function reconstructedCandidate(fixture, recommendation, policy = {}) {
  return new AgentArchitectureCandidate({
    id: recommendation.baseline.architecture.architectureId,
    description: 'operator-reconstructed candidate for holdout validation',
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: policy.maxEpisodes ?? 2,
      maxToolCallsPerEpisode: policy.maxToolCallsPerEpisode ?? 2
    }),
    components: recommendation.baseline.architecture.components
  });
}

function holdoutBudgets() {
  return {
    holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-validation',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const baseline = fixture.factory.manufacture({
  goal: 'create a generation that needs explicit holdout validation',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
assert.equal(baseline.status, 'ADOPTED');
const recommendation = fixture.factory.recommend();
assert.equal(
  recommendation.status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
);
const beforeLength = fixture.ledger.length;
const beforeLedger = fixture.ledger.serialize();
const candidate = reconstructedCandidate(fixture, recommendation);
const passed = fixture.factory.validateRecommendation(recommendation, {
  candidate,
  holdoutCases: [fixture.holdoutCase],
  ...holdoutBudgets()
});
assert.equal(isTrustedHarnessFactoryValidationReport(passed), true);
assert.equal(Object.isFrozen(passed), true);
assert.equal(passed.recommendationStatus, HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT);
assert.equal(passed.baselineGeneration, 1);
assert.equal(passed.architectureId, recommendation.baseline.architecture.architectureId);
assert.equal(passed.architectureFingerprint, recommendation.baseline.architecture.architectureFingerprint);
assert.equal(passed.status, HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED);
assert.equal(passed.passed, true);
assert.equal(passed.holdout.caseCount, 1);
assert.equal(passed.holdout.successes, 1);
assert.equal(passed.holdout.proven, 1);
assert.equal(passed.archived, false);
assert.equal(passed.dataOnly, true);
assert.equal(passed.authorityTransferred, false);
assert.equal(Object.hasOwn(passed, 'candidate'), false);
assert.equal(Object.hasOwn(passed, 'actionReport'), false);
assert.equal(fixture.ledger.length, beforeLength);
assert.equal(fixture.ledger.serialize(), beforeLedger);

const failedHoldout = new AgentPlannerCase({
  id: 'harness-factory-recommendation-validation-failed-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-recommendation-validation-failed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-recommendation-validation-failed-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles?.[0]?.action?.result?.path?.join('>') === 'A>C'
});
const failed = fixture.factory.validateRecommendation(recommendation, {
  candidate: reconstructedCandidate(fixture, recommendation),
  holdoutCases: [failedHoldout],
  ...holdoutBudgets()
});
assert.equal(isTrustedHarnessFactoryValidationReport(failed), true);
assert.equal(failed.status, HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED);
assert.equal(failed.passed, false);
assert.equal(failed.holdout.caseCount, 1);
assert.equal(failed.holdout.attemptedCases, 1);
assert.equal(failed.holdout.successes, 0);
assert.equal(failed.archived, false);
assert.equal(fixture.ledger.length, beforeLength);

console.log(
  `FLUID_HARNESS_FACTORY_RECOMMENDATION_VALIDATION_OK `
  + `recommendation=${recommendation.status} passed=${passed.status} `
  + `failed=${failed.status} cases=${passed.holdout.caseCount} `
  + `proven=${passed.holdout.proven} archived=${passed.archived} `
  + `ledgerUnchanged=${fixture.ledger.length === beforeLength} `
  + `authorityTransferred=${passed.authorityTransferred}`
);
