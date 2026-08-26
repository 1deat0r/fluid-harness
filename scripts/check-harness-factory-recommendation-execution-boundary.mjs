import assert from 'node:assert/strict';

import { AgentArchitectureAdoptionAuthority } from '../src/agent-architecture.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RECOMMENDATION_STATUSES,
  HarnessFactory,
  isTrustedHarnessFactoryRecommendationReport
} from '../src/harness-factory.mjs';
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

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-execution-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const noHistory = emptyFixture.factory.recommend();
assert.equal(noHistory.status, HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY);
assert.throws(
  () => emptyFixture.factory.executeRecommendation(noHistory, {}),
  /without an archived generation/
);
assert.equal(emptyFixture.ledger.length, 0);

const validationFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-execution-boundary-validation',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
validationFixture.factory.manufacture({
  goal: 'create a latest generation requiring holdout validation',
  plannerCandidates: [validationFixture.plannerCandidate],
  cases: [validationFixture.evaluationCase],
  ...validationFixture.budgets
});
const validationRecommendation = validationFixture.factory.recommend();
assert.equal(
  validationRecommendation.status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
);
const validationLedgerLength = validationFixture.ledger.length;
assert.throws(
  () => validationFixture.factory.executeRecommendation(validationRecommendation, {
    holdoutCases: [validationFixture.holdoutCase],
    ...validationFixture.budgets,
    holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
  }),
  /explicit candidate reconstruction/
);
assert.equal(validationFixture.ledger.length, validationLedgerLength);

const actionFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-execution-boundary-action',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includePartialPlanner: true,
  adoptionAuthority: relaxedAdoptionAuthority()
});
const actionCases = [actionFixture.evaluationCase, actionFixture.secondEvaluationCase];
const actionBudgets = twoCaseBudgets(2);
const actionHoldoutBudgets = {
  holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
};
actionFixture.factory.manufacture({
  goal: 'create an actionable strict-improvement recommendation',
  plannerCandidates: [actionFixture.partialPlannerCandidate, actionFixture.plannerCandidate],
  cases: actionCases,
  holdoutCases: [actionFixture.holdoutCase],
  ...actionBudgets,
  ...actionHoldoutBudgets
});
const recommendation = actionFixture.factory.recommend();
assert.equal(
  recommendation.status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.IMPROVE_LATEST_GENERATION
);
assert.equal(isTrustedHarnessFactoryRecommendationReport(recommendation), true);
const forged = Object.freeze({ ...recommendation });
const proxied = new Proxy(recommendation, {});
assert.equal(isTrustedHarnessFactoryRecommendationReport(forged), false);
assert.equal(isTrustedHarnessFactoryRecommendationReport(proxied), false);
assert.throws(
  () => actionFixture.factory.executeRecommendation(forged, {}),
  /exact recommendation from this factory/
);
assert.throws(
  () => actionFixture.factory.executeRecommendation(proxied, {}),
  /exact recommendation from this factory/
);
const otherFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-execution-boundary-other',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
assert.throws(
  () => otherFixture.factory.executeRecommendation(recommendation, {}),
  /exact recommendation from this factory/
);
const actionLedgerLength = actionFixture.ledger.length;
assert.throws(
  () => actionFixture.factory.executeRecommendation(recommendation, {
    archive: false
  }),
  /requires archive true/
);
assert.equal(actionFixture.ledger.length, actionLedgerLength);
assert.throws(
  () => actionFixture.factory.executeRecommendation(recommendation, {
    baselineGeneration: 99
  }),
  /baselineGeneration must match/
);
assert.equal(actionFixture.ledger.length, actionLedgerLength);
const accessorOptions = {};
Object.defineProperty(accessorOptions, 'goal', {
  enumerable: true,
  get: () => 'accessor goal'
});
assert.throws(
  () => actionFixture.factory.executeRecommendation(recommendation, accessorOptions),
  /only enumerable data properties/
);
assert.equal(actionFixture.ledger.length, actionLedgerLength);

const staleRecommendation = actionFixture.factory.recommend();
const staleGeneration = actionFixture.factory.manufacture({
  goal: 'advance the factory so the old recommendation becomes stale',
  plannerCandidates: [actionFixture.plannerCandidate],
  cases: actionCases,
  holdoutCases: [actionFixture.holdoutCase],
  ...actionBudgets,
  ...actionHoldoutBudgets
});
assert.equal(staleGeneration.status, 'ADOPTED');
assert.equal(staleGeneration.generation, 2);
assert.throws(
  () => actionFixture.factory.executeRecommendation(staleRecommendation, {}),
  /recommendation is stale/
);
assert.equal(actionFixture.ledger.length, 2);

const recoveryFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-execution-boundary-recovery',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includePartialPlanner: true,
  adoptionAuthority: relaxedAdoptionAuthority()
});
const secondHoldout = new AgentPlannerCase({
  id: 'harness-factory-recommendation-execution-boundary-second-holdout-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-recommendation-execution-boundary-second-holdout-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-recommendation-execution-boundary-second-holdout-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles?.[0]?.action?.evidence === 'PROVEN'
    && report.cycles?.[0]?.action?.result?.path?.join('>') === 'A>B'
});
const recoveryCases = [recoveryFixture.evaluationCase, recoveryFixture.secondEvaluationCase];
const recoveryBudgets = twoCaseBudgets(2);
const recoveryHoldoutBudgets = {
  holdoutProductionBudget: new EvaluationBudget({ maxCases: 2 }),
  holdoutResearchBudget: new EvaluationBudget({ maxCases: 2 }),
  holdoutSkepticBudget: new EvaluationBudget({ maxCases: 2 })
};
assert.throws(
  () => recoveryFixture.factory.manufacture({
    goal: 'create an unresolved recovery recommendation',
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
const recoveryLedgerLength = recoveryFixture.ledger.length;
assert.throws(
  () => recoveryFixture.factory.executeRecommendation(recoveryRecommendation, {
    plannerCandidates: [recoveryFixture.partialPlannerCandidate, recoveryFixture.plannerCandidate],
    cases: recoveryCases,
    ...recoveryBudgets,
    ...recoveryHoldoutBudgets
  }),
  /requires holdoutCases/
);
assert.equal(recoveryFixture.ledger.length, recoveryLedgerLength);

const proxyFactory = new Proxy(actionFixture.factory, {});
assert.throws(
  () => proxyFactory.executeRecommendation(recommendation, {}),
  /exact trusted factory/
);
Object.defineProperty(actionFixture.ledger, 'serialize', {
  configurable: true,
  value: () => actionFixture.ledger.serialize()
});
assert.throws(
  () => actionFixture.factory.executeRecommendation(recommendation, {}),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_RECOMMENDATION_EXECUTION_BOUNDARY_OK `
  + `noHistoryRejected=true validationRejected=true forgedRejected=true `
  + `proxiedRecommendationRejected=true crossFactoryRejected=true `
  + `archiveRequired=true baselineBound=true accessorRejected=true `
  + `staleRejected=true missingRecoveryHoldoutRejected=true `
  + `mutableLedgerRejected=true authoritySuppressed=true`
);
