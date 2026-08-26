import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RECOMMENDATION_STATUSES,
  HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES,
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryResearchPlanReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function holdoutBudgets(maxCases = 1) {
  return {
    holdoutProductionBudget: new EvaluationBudget({ maxCases }),
    holdoutResearchBudget: new EvaluationBudget({ maxCases }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases })
  };
}

function reconstructedCandidate(fixture, recommendation) {
  return new AgentArchitectureCandidate({
    id: recommendation.baseline.architecture.architectureId,
    description: 'operator-reconstructed candidate for research plan checks',
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: recommendation.baseline.architecture.components
  });
}

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

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyPlan = emptyFixture.factory.researchPlan();
assert.equal(isTrustedHarnessFactoryResearchPlanReport(emptyPlan), true);
assert.equal(Object.isFrozen(emptyPlan), true);
assert.equal(Object.isFrozen(emptyPlan.plans), true);
assert.equal(emptyPlan.recommendationStatus, HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY);
assert.equal(emptyPlan.consideredTargetCount, 0);
assert.deepEqual(emptyPlan.plans, []);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
fixture.factory.manufacture({
  goal: 'create a generation for research planning',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const validationPlan = fixture.factory.researchPlan({ maxItems: 1 });
assert.equal(validationPlan.recommendationStatus, HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT);
assert.equal(validationPlan.plans.length, 1);
assert.equal(validationPlan.plans[0].target, HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT);
assert.equal(validationPlan.plans[0].bridge, HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.HOLDOUT_VALIDATION);
assert.equal(
  validationPlan.plans[0].executionMethod,
  'factory.validateRecommendation + factory.archiveValidation'
);
assert.equal(validationPlan.plans[0].requiredInputs.length > 0, true);
assert.equal(validationPlan.plans[0].expectedEvidence.length > 0, true);
assert.equal(Object.isFrozen(validationPlan.plans[0]), true);
assert.equal(Object.isFrozen(validationPlan.plans[0].requiredInputs), true);
assert.equal(Object.isFrozen(validationPlan.plans[0].expectedEvidence), true);
assert.equal(Object.hasOwn(validationPlan.plans[0], 'candidate'), false);
assert.equal(Object.hasOwn(validationPlan.plans[0], 'runner'), false);

const recommendation = fixture.factory.recommend();
const validation = fixture.factory.validateRecommendation(recommendation, {
  candidate: reconstructedCandidate(fixture, recommendation),
  holdoutCases: [fixture.holdoutCase],
  ...holdoutBudgets()
});
fixture.factory.archiveValidation(validation);
const improvementPlan = fixture.factory.researchPlan();
assert.equal(improvementPlan.recommendationStatus, HARNESS_FACTORY_RECOMMENDATION_STATUSES.IMPROVE_LATEST_GENERATION);
assert.equal(improvementPlan.plans[0].target, HARNESS_FACTORY_RESEARCH_TARGETS.IMPROVE_LATEST_GENERATION);
assert.equal(improvementPlan.plans[0].bridge, HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.FACTORY_RECOMMENDATION);
assert.equal(improvementPlan.plans[0].executionMethod, 'factory.executeRecommendation');
assert.equal(improvementPlan.plans[0].generation, 1);
assert.equal(improvementPlan.plans[0].holdoutStatus, 'PASSED');

const frontierFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-frontier',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const first = buildCampaign(frontierFixture, 'rpf');
const second = buildCampaign(frontierFixture, 'rpf');
archivePoint(frontierFixture, first.campaign, first.alpha, frontierFixture.plannerCandidate, first.level);
archivePoint(
  frontierFixture,
  first.campaign,
  first.beta,
  first.alternatePlannerCandidate,
  first.level
);
archivePoint(frontierFixture, second.campaign, second.alpha, frontierFixture.plannerCandidate, second.level);
const frontierPlan = frontierFixture.factory.researchPlan();
assert.equal(frontierPlan.recommendationStatus, HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY);
assert.equal(frontierPlan.consideredTargetCount, 2);
assert.equal(frontierPlan.plans.length, 2);
assert.equal(frontierPlan.truncated, false);
assert.equal(
  frontierPlan.plans[0].target,
  HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
);
assert.equal(
  frontierPlan.plans[0].bridge,
  HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.BENCHMARK_FRONTIER_VALIDATION
);
assert.equal(
  frontierPlan.plans[1].target,
  HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
);
assert.equal(
  frontierPlan.plans[1].bridge,
  HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.FRONTIER_STABILITY
);
assert.equal(frontierPlan.plans[1].generation, null);
assert.equal(frontierPlan.dataOnly, true);
assert.equal(frontierPlan.authorityTransferred, false);
assert.equal(
  frontierPlan.plans.every((plan) => Object.hasOwn(plan, 'actionReport') === false),
  true
);
const truncatedFrontierPlan = frontierFixture.factory.researchPlan({ maxItems: 1 });
assert.equal(truncatedFrontierPlan.consideredTargetCount, 2);
assert.equal(truncatedFrontierPlan.returnedPlanCount, 1);
assert.equal(truncatedFrontierPlan.truncated, true);
assert.equal(truncatedFrontierPlan.complete, false);

console.log(
  `FLUID_HARNESS_FACTORY_RESEARCH_PLAN_OK `
  + `empty=${emptyPlan.recommendationStatus} `
  + `validation=${validationPlan.plans[0].target} `
  + `improvement=${improvementPlan.plans[0].target} `
  + `frontier=${frontierPlan.plans[0].target} `
  + `stability=${frontierPlan.plans[1].target} `
  + `truncated=${truncatedFrontierPlan.truncated} `
  + `dataOnly=${frontierPlan.dataOnly} `
  + `authorityTransferred=${frontierPlan.authorityTransferred}`
);
