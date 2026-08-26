import assert from 'node:assert/strict';

import { AgentArchitectureAdoptionAuthority } from '../src/agent-architecture.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RECOMMENDATION_STATUSES,
  isTrustedHarnessFactoryRecommendationReport
} from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const emptyRecommendation = emptyFixture.factory.recommend();
assert.equal(isTrustedHarnessFactoryRecommendationReport(emptyRecommendation), true);
assert.equal(emptyRecommendation.status, HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY);
assert.equal(emptyRecommendation.baseline, null);
assert.equal(emptyRecommendation.baselineGeneration, null);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includePartialPlanner: true,
  adoptionAuthority: new AgentArchitectureAdoptionAuthority({
    minimumProductionSuccessRate: 0.5,
    minimumProductionProvenRate: 0.5,
    minimumResearchSuccessRate: 0.5,
    minimumResearchProvenRate: 0.5,
    minimumSkepticSuccessRate: 0,
    minimumTransferSuccessRate: 0
  })
});
const secondHoldout = new AgentPlannerCase({
  id: 'harness-factory-recommendation-second-holdout-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-recommendation-second-holdout-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-recommendation-second-holdout-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles?.[0]?.action?.evidence === 'PROVEN'
    && report.cycles?.[0]?.action?.result?.path?.join('>') === 'A>B'
});
const mainCases = [fixture.evaluationCase, fixture.secondEvaluationCase];
const holdoutCases = [fixture.holdoutCase, secondHoldout];
const mainBudgets = {
  productionBudget: new EvaluationBudget({ maxCases: 2 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 2 })
};
const holdoutBudgets = {
  holdoutProductionBudget: new EvaluationBudget({ maxCases: 2 }),
  holdoutResearchBudget: new EvaluationBudget({ maxCases: 2 }),
  holdoutSkepticBudget: new EvaluationBudget({ maxCases: 2 })
};

assert.throws(
  () => fixture.factory.manufacture({
    goal: 'create an unresolved failed holdout for recommendation',
    plannerCandidates: [fixture.partialPlannerCandidate],
    cases: mainCases,
    holdoutCases,
    ...mainBudgets,
    ...holdoutBudgets
  }),
  /holdout benchmark rejected/
);
assert.equal(fixture.ledger.length, 1);
const beforeFailedRecommendationLength = fixture.ledger.length;
const failedRecommendation = fixture.factory.recommend();
assert.equal(isTrustedHarnessFactoryRecommendationReport(failedRecommendation), true);
assert.equal(
  failedRecommendation.status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.RECOVER_FAILED_HOLDOUT
);
assert.equal(failedRecommendation.baselineGeneration, 1);
assert.equal(failedRecommendation.baseline.holdoutStatus, 'FAILED');
assert.equal(failedRecommendation.baseline.holdoutStatus, 'FAILED');
assert.equal(fixture.ledger.length, beforeFailedRecommendationLength);

const recovered = fixture.factory.improve({
  goal: 'recover the generation selected by the recommendation',
  plannerCandidates: [fixture.partialPlannerCandidate, fixture.plannerCandidate],
  cases: mainCases,
  holdoutCases,
  ...mainBudgets,
  ...holdoutBudgets,
  memoryQuery: {
    source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
    keywords: ['holdout-failed']
  }
});
assert.equal(recovered.status, 'ADOPTED');
const recoveredRecommendation = fixture.factory.recommend();
assert.equal(
  recoveredRecommendation.status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.IMPROVE_LATEST_GENERATION
);
assert.equal(recoveredRecommendation.baselineGeneration, 2);
assert.equal(recoveredRecommendation.baseline.holdoutStatus, 'PASSED');
assert.equal(recoveredRecommendation.baseline.status, 'ADOPTED');
assert.equal(recoveredRecommendation.dataOnly, true);
assert.equal(recoveredRecommendation.authorityTransferred, false);

const validationFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-validation',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
validationFixture.factory.manufacture({
  goal: 'create a generation without holdout validation',
  plannerCandidates: [validationFixture.plannerCandidate],
  cases: [validationFixture.evaluationCase],
  ...validationFixture.budgets
});
const validationRecommendation = validationFixture.factory.recommend();
assert.equal(
  validationRecommendation.status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
);
assert.equal(validationRecommendation.baselineGeneration, 1);
assert.equal(validationRecommendation.baseline.holdoutStatus, 'NOT_RUN');

console.log(
  `FLUID_HARNESS_FACTORY_RECOMMENDATION_OK `
  + `empty=${emptyRecommendation.status} failed=${failedRecommendation.status} `
  + `failedBaseline=${failedRecommendation.baselineGeneration} `
  + `recovered=${recoveredRecommendation.status} `
  + `recoveredBaseline=${recoveredRecommendation.baselineGeneration} `
  + `validate=${validationRecommendation.status} `
  + `authorityTransferred=${recoveredRecommendation.authorityTransferred}`
);
