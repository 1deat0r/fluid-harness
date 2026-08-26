import assert from 'node:assert/strict';

import { AgentArchitectureAdoptionAuthority } from '../src/agent-architecture.mjs';
import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES,
  HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES,
  HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES,
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryBenchmarkFrontierValidationResearchExecutionReport,
  isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityResearchExecutionReport,
  isTrustedHarnessFactoryReport,
  isTrustedHarnessFactoryResearchPlanExecutionHistoryReport,
  isTrustedHarnessFactoryResearchPlanExecutionReport,
  isTrustedHarnessFactoryValidationReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function holdoutBudgets(maxCases = 1) {
  return {
    holdoutProductionBudget: new EvaluationBudget({ maxCases }),
    holdoutResearchBudget: new EvaluationBudget({ maxCases }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases })
  };
}

function reconstructedCandidate(fixture, recommendation, description) {
  return new AgentArchitectureCandidate({
    id: recommendation.baseline.architecture.architectureId,
    description,
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: recommendation.baseline.architecture.components
  });
}

function relaxedAdoptionAuthority() {
  return new AgentArchitectureAdoptionAuthority({
    minimumProductionSuccessRate: 0.5,
    minimumProductionProvenRate: 0.5,
    minimumResearchSuccessRate: 0.5,
    minimumResearchProvenRate: 0.5,
    minimumSkepticSuccessRate: 0,
    minimumTransferSuccessRate: 0
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

const holdoutFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-execution-holdout',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
holdoutFixture.factory.manufacture({
  goal: 'create a generation for plan execution',
  plannerCandidates: [holdoutFixture.plannerCandidate],
  cases: [holdoutFixture.evaluationCase],
  ...holdoutFixture.budgets
});
const holdoutPlan = holdoutFixture.factory.researchPlan();
assert.equal(holdoutPlan.recommendationStatus, HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT);
assert.equal(holdoutPlan.plans[0].target, HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT);
assert.equal(holdoutPlan.plans[0].bridge, HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.HOLDOUT_VALIDATION);
const holdoutRecommendation = holdoutFixture.factory.recommend();
const holdoutReceipt = holdoutFixture.factory.executeResearchPlanReceipt(
  holdoutPlan.plans[0],
  {
    candidate: reconstructedCandidate(
      holdoutFixture,
      holdoutRecommendation,
      'candidate reconstructed by the research-plan executor'
    ),
    holdoutCases: [holdoutFixture.holdoutCase],
    ...holdoutBudgets()
  }
);
const archivedHoldout = holdoutReceipt.result;
assert.equal(isTrustedHarnessFactoryResearchPlanExecutionReport(holdoutReceipt), true);
assert.equal(holdoutReceipt.resultType, HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.VALIDATION);
assert.equal(holdoutReceipt.resultStatus, 'PASSED');
assert.deepEqual(holdoutReceipt.resultArchiveSequences, [2]);
assert.equal(holdoutReceipt.archive.kind, 'harness-factory-research-plan-execution');
assert.equal(holdoutReceipt.archive.sequence, 3);
assert.equal(holdoutReceipt.archived, true);
assert.equal(holdoutReceipt.dataOnly, true);
assert.equal(holdoutReceipt.authorityTransferred, false);
assert.equal(isTrustedHarnessFactoryValidationReport(archivedHoldout), true);
assert.equal(archivedHoldout.archived, true);
assert.equal(archivedHoldout.status, 'PASSED');
assert.equal(holdoutFixture.ledger.length, 3);
const holdoutExecutionHistory = holdoutFixture.factory.researchPlanExecutions();
assert.equal(isTrustedHarnessFactoryResearchPlanExecutionHistoryReport(holdoutExecutionHistory), true);
assert.equal(holdoutExecutionHistory.consideredExecutionCount, 1);
assert.equal(holdoutExecutionHistory.returnedExecutionCount, 1);
assert.equal(holdoutExecutionHistory.executions[0].archive.sequence, 3);
assert.equal(
  holdoutFixture.factory.recommend().status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.IMPROVE_LATEST_GENERATION
);

const improvementFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-execution-improvement',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includePartialPlanner: true,
  adoptionAuthority: relaxedAdoptionAuthority()
});
const improvementCases = [
  improvementFixture.evaluationCase,
  improvementFixture.secondEvaluationCase
];
const improvementBudgets = {
  productionBudget: new EvaluationBudget({ maxCases: 2 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 2 })
};
const firstImprovement = improvementFixture.factory.manufacture({
  goal: 'create a strict-improvement plan',
  plannerCandidates: [improvementFixture.partialPlannerCandidate, improvementFixture.plannerCandidate],
  cases: improvementCases,
  holdoutCases: [improvementFixture.holdoutCase],
  ...improvementBudgets,
  ...holdoutBudgets()
});
assert.equal(firstImprovement.status, 'ADOPTED');
const improvementPlan = improvementFixture.factory.researchPlan();
assert.equal(improvementPlan.plans[0].target, HARNESS_FACTORY_RESEARCH_TARGETS.IMPROVE_LATEST_GENERATION);
assert.equal(improvementPlan.plans[0].bridge, HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.FACTORY_RECOMMENDATION);
const improved = improvementFixture.factory.executeResearchPlan(
  improvementPlan.plans[0],
  {
    goal: 'execute the strict-improvement plan',
    plannerCandidates: [improvementFixture.plannerCandidate, improvementFixture.partialPlannerCandidate],
    cases: improvementCases,
    holdoutCases: [improvementFixture.holdoutCase],
    ...improvementBudgets,
    ...holdoutBudgets()
  }
);
assert.equal(isTrustedHarnessFactoryReport(improved), true);
assert.equal(improved.status, 'ADOPTED');
assert.equal(improved.generation, 2);
assert.equal(improved.improvement.strictlyImproved, true);
assert.equal(improvementFixture.ledger.length, 3);

const frontierFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-execution-frontier',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const frontier = buildCampaign(frontierFixture, 'rpe-frontier');
archivePoint(
  frontierFixture,
  frontier.campaign,
  frontier.alpha,
  frontierFixture.plannerCandidate,
  frontier.level
);
const frontierPlan = frontierFixture.factory.researchPlan();
const frontierPlanItem = frontierPlan.plans.find(
  ({ target }) => target === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
);
assert.notEqual(frontierPlanItem, undefined);
const frontierExecution = frontierFixture.factory.executeResearchPlan(
  frontierPlanItem,
  {
    campaign: frontier.campaign,
    points: [
      {
        candidate: buildCandidate(
          frontierFixture,
          frontier.beta.id,
          frontier.alternatePlannerCandidate,
          'beta'
        ),
        levelId: frontier.level.id
      }
    ],
    cases: [frontierFixture.evaluationCase],
    holdoutCases: [frontierFixture.holdoutCase],
    holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 }),
    archive: true
  }
);
assert.equal(
  isTrustedHarnessFactoryBenchmarkFrontierValidationResearchExecutionReport(
    frontierExecution
  ),
  true
);
assert.equal(frontierExecution.frontierStatus, 'PASSED');
assert.equal(frontierExecution.targetResolved, true);
assert.equal(frontierExecution.validationCount, 1);
assert.equal(frontierFixture.ledger.length, 4);

const stabilityFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-execution-stability',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const firstCampaign = buildCampaign(stabilityFixture, 'rpe-stability');
const secondCampaign = buildCampaign(stabilityFixture, 'rpe-stability');
archivePoint(
  stabilityFixture,
  firstCampaign.campaign,
  firstCampaign.alpha,
  stabilityFixture.plannerCandidate,
  firstCampaign.level
);
archivePoint(
  stabilityFixture,
  firstCampaign.campaign,
  firstCampaign.beta,
  firstCampaign.alternatePlannerCandidate,
  firstCampaign.level
);
archivePoint(
  stabilityFixture,
  secondCampaign.campaign,
  secondCampaign.alpha,
  stabilityFixture.plannerCandidate,
  secondCampaign.level
);
const stabilityPlan = stabilityFixture.factory.researchPlan();
const stabilityPlanItem = stabilityPlan.plans.find(
  ({ target }) => target === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
);
assert.notEqual(stabilityPlanItem, undefined);
const stabilityExecution = stabilityFixture.factory.executeResearchPlan(
  stabilityPlanItem,
  {
    campaign: secondCampaign.campaign,
    points: [
      {
        candidate: buildCandidate(
          stabilityFixture,
          secondCampaign.beta.id,
          secondCampaign.alternatePlannerCandidate,
          'beta'
        ),
        levelId: secondCampaign.level.id
      }
    ],
    cases: [stabilityFixture.evaluationCase],
    holdoutCases: [stabilityFixture.holdoutCase],
    holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 }),
    archive: true
  }
);
assert.equal(
  isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityResearchExecutionReport(
    stabilityExecution
  ),
  true
);
assert.equal(
  stabilityExecution.frontierStatus,
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE
);
assert.equal(stabilityExecution.targetResolved, true);
assert.equal(stabilityExecution.validationCount, 1);
assert.equal(stabilityFixture.ledger.length, 7);

function transferGapCase() {
  return new AgentPlannerCase({
    id: 'harness-factory-research-plan-execution-transfer-gap-case',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'harness-factory-research-plan-execution-transfer-gap-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'harness-factory-research-plan-execution-transfer-gap-task',
      description: 'Find a graph path'
    },
    adversarial: false,
    productionEligible: false,
    expected: (report) => report?.completed === true
      && report.cycles?.[0]?.action?.result?.path?.join('>') === 'A>C'
  });
}

const operatorFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-execution-operator',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect',
  adoptionAuthority: new AgentArchitectureAdoptionAuthority({
    minimumProductionSuccessRate: 1,
    minimumProductionProvenRate: 1,
    minimumResearchSuccessRate: 0,
    minimumResearchProvenRate: 0,
    minimumSkepticSuccessRate: 1,
    minimumTransferSuccessRate: 0
  })
});
operatorFixture.factory.manufacture({
  goal: 'create an operator-only transfer experiment',
  plannerCandidates: [operatorFixture.plannerCandidate],
  cases: [operatorFixture.evaluationCase, transferGapCase()],
  holdoutCases: [operatorFixture.holdoutCase],
  productionBudget: new EvaluationBudget({ maxCases: 2 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 2 }),
  ...holdoutBudgets()
});
const operatorPlan = operatorFixture.factory.researchPlan({ maxItems: 1 });
assert.equal(operatorPlan.plans[0].target, HARNESS_FACTORY_RESEARCH_TARGETS.TEST_TRANSFER_GAP);
assert.equal(operatorPlan.plans[0].bridge, HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.OPERATOR_EXPERIMENT);
assert.throws(
  () => operatorFixture.factory.executeResearchPlan(operatorPlan.plans[0]),
  /operator-supplied experiment/
);

console.log(
  `FLUID_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_OK `
  + `holdout=${archivedHoldout.status} improvement=${improved.status} `
  + `frontier=${frontierExecution.frontierStatus} `
  + `stability=${stabilityExecution.frontierStatus} `
  + `operatorOnlyRejected=true`
);
