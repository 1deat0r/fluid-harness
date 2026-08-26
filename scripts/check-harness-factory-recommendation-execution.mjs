import assert from 'node:assert/strict';

import { AgentArchitectureAdoptionAuthority } from '../src/agent-architecture.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RECOMMENDATION_STATUSES,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

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

function twoCaseBudgets(maxCases) {
  return {
    productionBudget: new EvaluationBudget({ maxCases }),
    researchBudget: new EvaluationBudget({ maxCases }),
    skepticBudget: new EvaluationBudget({ maxCases })
  };
}

const improvementFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-execution-improve',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includePartialPlanner: true,
  adoptionAuthority: relaxedAdoptionAuthority()
});
const improvementCases = [
  improvementFixture.evaluationCase,
  improvementFixture.secondEvaluationCase
];
const improvementBudgets = twoCaseBudgets(2);
const improvementHoldoutBudgets = {
  holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
};
const firstImprovement = improvementFixture.factory.manufacture({
  goal: 'create an adopted baseline for recommendation execution',
  plannerCandidates: [improvementFixture.partialPlannerCandidate, improvementFixture.plannerCandidate],
  cases: improvementCases,
  holdoutCases: [improvementFixture.holdoutCase],
  ...improvementBudgets,
  ...improvementHoldoutBudgets
});
assert.equal(firstImprovement.status, 'ADOPTED');
assert.equal(firstImprovement.holdoutStatus, 'PASSED');
const improvementRecommendation = improvementFixture.factory.recommend();
assert.equal(
  improvementRecommendation.status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.IMPROVE_LATEST_GENERATION
);
assert.equal(improvementRecommendation.baselineGeneration, 1);
const improved = improvementFixture.factory.executeRecommendation(
  improvementRecommendation,
  {
    goal: 'execute the strict improvement recommendation with caller-selected candidates',
    plannerCandidates: [improvementFixture.plannerCandidate, improvementFixture.partialPlannerCandidate],
    cases: improvementCases,
    holdoutCases: [improvementFixture.holdoutCase],
    ...improvementBudgets,
    ...improvementHoldoutBudgets,
    memoryQuery: {
      source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
      keywords: ['adopted']
    }
  }
);
assert.equal(isTrustedHarnessFactoryReport(improved), true);
assert.equal(improved.status, 'ADOPTED');
assert.equal(improved.generation, 2);
assert.equal(improved.improvement.accepted, true);
assert.equal(improved.improvement.strictlyImproved, true);
assert.equal(improved.improvement.baseline.archive.sequence, 1);
assert.equal(improved.holdoutStatus, 'PASSED');
assert.equal(improvementFixture.ledger.length, 2);

const recoveryFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-execution-recovery',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includePartialPlanner: true,
  adoptionAuthority: relaxedAdoptionAuthority()
});
const secondHoldout = new AgentPlannerCase({
  id: 'harness-factory-recommendation-execution-recovery-second-holdout-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-recommendation-execution-recovery-second-holdout-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-recommendation-execution-recovery-second-holdout-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles?.[0]?.action?.evidence === 'PROVEN'
    && report.cycles?.[0]?.action?.result?.path?.join('>') === 'A>B'
});
const recoveryCases = [
  recoveryFixture.evaluationCase,
  recoveryFixture.secondEvaluationCase
];
const recoveryBudgets = twoCaseBudgets(2);
const recoveryHoldoutBudgets = {
  holdoutProductionBudget: new EvaluationBudget({ maxCases: 2 }),
  holdoutResearchBudget: new EvaluationBudget({ maxCases: 2 }),
  holdoutSkepticBudget: new EvaluationBudget({ maxCases: 2 })
};
assert.throws(
  () => recoveryFixture.factory.manufacture({
    goal: 'create the failed holdout recommendation',
    plannerCandidates: [recoveryFixture.partialPlannerCandidate],
    cases: recoveryCases,
    holdoutCases: [recoveryFixture.holdoutCase, secondHoldout],
    ...recoveryBudgets,
    ...recoveryHoldoutBudgets
  }),
  /holdout benchmark rejected/
);
const recoveryRecommendation = recoveryFixture.factory.recommend();
assert.equal(
  recoveryRecommendation.status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.RECOVER_FAILED_HOLDOUT
);
const recovered = recoveryFixture.factory.executeRecommendation(
  recoveryRecommendation,
  {
    goal: 'execute the failed-holdout recovery recommendation',
    plannerCandidates: [recoveryFixture.partialPlannerCandidate, recoveryFixture.plannerCandidate],
    cases: recoveryCases,
    holdoutCases: [recoveryFixture.holdoutCase, secondHoldout],
    ...recoveryBudgets,
    ...recoveryHoldoutBudgets,
    memoryQuery: {
      source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
      keywords: ['holdout-failed']
    }
  }
);
assert.equal(isTrustedHarnessFactoryReport(recovered), true);
assert.equal(recovered.status, 'ADOPTED');
assert.equal(recovered.generation, 2);
assert.equal(recovered.improvement.baseline.archive.sequence, 1);
assert.equal(recovered.improvement.strictlyImproved, true);
assert.equal(recovered.holdoutStatus, 'PASSED');
assert.equal(recovered.holdout.caseCount, 2);
assert.equal(recovered.holdout.successes, 2);
assert.equal(recoveryFixture.ledger.length, 2);

console.log(
  `FLUID_HARNESS_FACTORY_RECOMMENDATION_EXECUTION_OK `
  + `improve=${improved.status} improveBaseline=${improved.improvement.baseline.archive.sequence} `
  + `strict=${improved.improvement.strictlyImproved} `
  + `recovery=${recovered.status} recoveryBaseline=${recovered.improvement.baseline.archive.sequence} `
  + `holdoutCases=${recovered.holdout.caseCount} archived=${recoveryFixture.ledger.length} `
  + `authorityTransferred=${recovered.authorityTransferred}`
);
