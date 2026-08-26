import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
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

function reconstructedCandidate(fixture, recommendation) {
  return new AgentArchitectureCandidate({
    id: recommendation.baseline.architecture.architectureId,
    description: 'operator-reconstructed candidate for validation archival',
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
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

function failedHoldoutCase() {
  return new AgentPlannerCase({
    id: 'harness-factory-recommendation-validation-archive-failed-holdout',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'harness-factory-recommendation-validation-archive-failed-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'harness-factory-recommendation-validation-archive-failed-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (report) => report?.completed === true
      && report.cycles?.[0]?.action?.result?.path?.join('>') === 'A>C'
  });
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-validation-archive',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
fixture.factory.manufacture({
  goal: 'create a generation for archived validation',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const recommendation = fixture.factory.recommend();
assert.equal(
  recommendation.status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
);
const validation = fixture.factory.validateRecommendation(recommendation, {
  candidate: reconstructedCandidate(fixture, recommendation),
  holdoutCases: [fixture.holdoutCase],
  ...holdoutBudgets()
});
const archived = fixture.factory.archiveValidation(validation);
assert.equal(isTrustedHarnessFactoryValidationReport(archived), true);
assert.equal(Object.isFrozen(archived), true);
assert.equal(archived.status, HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED);
assert.equal(archived.archived, true);
assert.equal(archived.archive.kind, 'harness-factory-validation');
assert.equal(fixture.ledger.length, 2);
assert.equal(fixture.ledger.records[1].kind, 'harness-factory-validation');
assert.equal(fixture.ledger.records[1].payload.dataOnly, true);
assert.equal(fixture.ledger.records[1].payload.authorityTransferred, false);
assert.equal(Object.hasOwn(fixture.ledger.records[1].payload, 'candidate'), false);
assert.equal(Object.hasOwn(fixture.ledger.records[1].payload, 'actionReport'), false);
const restored = fixture.ledger.restoreHarnessFactoryValidations();
assert.equal(restored.length, 1);
assert.equal(restored[0].status, HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED);
assert.deepEqual(restored[0].archive, archived.archive);
assert.equal(restored[0].holdout.proven, 1);
assert.equal(fixture.ledger.restoreArchitectureDiscoveries().length, 1);
assert.equal(fixture.factory.history().consideredGenerationCount, 1);
assert.equal(fixture.factory.history().generations[0].holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN);
const afterPass = fixture.factory.recommend();
assert.equal(
  afterPass.status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.IMPROVE_LATEST_GENERATION
);
assert.equal(afterPass.baselineGeneration, 1);
const roundTrip = EvidenceLedger.fromSerialized(fixture.ledger.serialize());
assert.equal(roundTrip.verify(), true);
assert.deepEqual(roundTrip.restoreHarnessFactoryValidations(), restored);

const failedFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-validation-archive-failed',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
failedFixture.factory.manufacture({
  goal: 'create a generation for archived failed validation',
  plannerCandidates: [failedFixture.plannerCandidate],
  cases: [failedFixture.evaluationCase],
  ...failedFixture.budgets
});
const failedRecommendation = failedFixture.factory.recommend();
const failedValidation = failedFixture.factory.validateRecommendation(
  failedRecommendation,
  {
    candidate: reconstructedCandidate(failedFixture, failedRecommendation),
    holdoutCases: [failedHoldoutCase()],
    ...holdoutBudgets()
  }
);
const archivedFailure = failedFixture.factory.archiveValidation(failedValidation);
assert.equal(archivedFailure.status, HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED);
assert.equal(archivedFailure.archived, true);
assert.equal(
  failedFixture.factory.recommend().status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.RECOVER_FAILED_HOLDOUT
);
assert.equal(failedFixture.ledger.length, 2);
assert.equal(failedFixture.ledger.restoreHarnessFactoryValidations()[0].status, 'FAILED');

console.log(
  `FLUID_HARNESS_FACTORY_RECOMMENDATION_VALIDATION_ARCHIVE_OK `
  + `passed=${archived.status} failed=${archivedFailure.status} `
  + `recordKind=${archived.archive.kind} records=${fixture.ledger.length} `
  + `roundTrip=${roundTrip.verify()} next=${afterPass.status} `
  + `failedNext=${failedFixture.factory.recommend().status} `
  + `generationCount=${fixture.factory.history().consideredGenerationCount} `
  + `authorityTransferred=${archived.authorityTransferred}`
);
