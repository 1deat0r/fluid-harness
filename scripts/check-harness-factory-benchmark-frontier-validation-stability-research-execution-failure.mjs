import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES,
  HARNESS_FACTORY_RESEARCH_TARGETS
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

function buildCampaign(fixture, prefix) {
  const alternatePlannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-alternate`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
  const alpha = buildCandidate(fixture, `${prefix}-alpha`, fixture.plannerCandidate, 'alpha');
  const beta = buildCandidate(fixture, `${prefix}-beta`, alternatePlannerCandidate, 'beta');
  const level = {
    id: `${prefix}-budget`,
    computeUnits: 1,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
  return {
    alpha,
    beta,
    alternatePlannerCandidate,
    level,
    campaign: fixture.factory.archiveBenchmarkCampaign(
      fixture.factory.benchmarkCampaign({
        candidates: [alpha, beta],
        cases: [fixture.evaluationCase],
        levels: [level]
      })
    )
  };
}

function archivePoint(fixture, campaign, candidate, plannerCandidate, level) {
  return fixture.factory.archiveBenchmarkCampaignValidation(
    fixture.factory.validateBenchmarkCampaign(campaign, {
      candidate: buildCandidate(
        fixture,
        candidate.id,
        plannerCandidate,
        candidate.components.variant
      ),
      levelId: level.id,
      cases: [fixture.evaluationCase],
      holdoutCases: [fixture.holdoutCase]
    })
  );
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-stability-research-execution-failure',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const first = buildCampaign(
  fixture,
  'harness-factory-benchmark-frontier-validation-stability-research-execution-failure-repeat'
);
const second = buildCampaign(
  fixture,
  'harness-factory-benchmark-frontier-validation-stability-research-execution-failure-repeat'
);
archivePoint(fixture, first.campaign, first.alpha, fixture.plannerCandidate, first.level);
archivePoint(
  fixture,
  first.campaign,
  first.beta,
  first.alternatePlannerCandidate,
  first.level
);
archivePoint(fixture, second.campaign, second.alpha, fixture.plannerCandidate, second.level);

const target = fixture.factory.researchAgenda().items.find(
  ({ target: itemTarget }) => itemTarget
    === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
);
assert.notEqual(target, undefined);
assert.equal(target.frontierStability.variablePoints.length, 1);

const failingHoldoutCase = new AgentPlannerCase({
  id: 'harness-factory-benchmark-frontier-validation-stability-research-execution-failure-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-frontier-validation-stability-research-execution-failure-holdout-task',
    description: 'Find a graph path that must fail its declared expectation'
  },
  task: {
    id: 'harness-factory-benchmark-frontier-validation-stability-research-execution-failure-holdout-task',
    description: 'Find a graph path that must fail its declared expectation'
  },
  adversarial: true,
  expected: () => false
});
const beforeExecution = fixture.ledger.serialize();
const rechecked = fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
  target,
  {
    campaign: second.campaign,
    points: [
      {
        candidate: buildCandidate(
          fixture,
          second.beta.id,
          second.alternatePlannerCandidate,
          'beta'
        ),
        levelId: second.level.id
      }
    ],
    cases: [fixture.evaluationCase],
    holdoutCases: [failingHoldoutCase]
  }
);

assert.equal(rechecked.status, 'FAILED');
assert.equal(rechecked.validationCount, 1);
assert.equal(rechecked.passedCount, 0);
assert.equal(rechecked.failedCount, 1);
assert.equal(
  rechecked.frontierStatus,
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
);
assert.equal(rechecked.stabilityStatus, rechecked.frontierStatus);
assert.equal(rechecked.stablePointCount, 1);
assert.equal(rechecked.unstablePointCount, 1);
assert.equal(rechecked.insufficientPointCount, 0);
assert.equal(rechecked.targetResolved, false);
assert.deepEqual(rechecked.remainingVariablePoints, [
  { candidateId: second.beta.id, levelId: second.level.id }
]);
assert.equal(rechecked.validations[0].status, 'FAILED');
assert.equal(rechecked.validations[0].archived, true);
assert.equal(rechecked.dataOnly, true);
assert.equal(rechecked.authorityTransferred, false);
assert.equal(fixture.ledger.length, 6);
assert.notEqual(fixture.ledger.serialize(), beforeExecution);

const recoveredAgenda = fixture.factory.researchAgenda();
const remainingTarget = recoveredAgenda.items.find(
  ({ target: itemTarget }) => itemTarget
    === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
);
assert.notEqual(remainingTarget, undefined);
assert.equal(remainingTarget.frontierStability.variablePoints.length, 1);
assert.equal(remainingTarget.frontierStability.variablePoints[0].candidateId, second.beta.id);
assert.equal(remainingTarget.frontierStability.variablePoints[0].levelId, second.level.id);
assert.equal(
  remainingTarget.frontierStability.variablePoints[0].stabilityStatus,
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
);
assert.equal(
  recoveredAgenda.items.some(
    ({ target: itemTarget }) => itemTarget
      === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
  ),
  false
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH_EXECUTION_FAILURE_OK `
  + `validated=${rechecked.validationCount} passed=${rechecked.passedCount} `
  + `frontierStatus=${rechecked.frontierStatus} targetResolved=${rechecked.targetResolved} `
  + `remainingVariablePoints=${rechecked.remainingVariablePoints.length} `
  + `requeued=${remainingTarget !== undefined} ledgerEntries=${fixture.ledger.length} `
  + `dataOnly=${rechecked.dataOnly} authorityTransferred=${rechecked.authorityTransferred}`
);
