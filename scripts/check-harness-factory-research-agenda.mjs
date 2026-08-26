import assert from 'node:assert/strict';

import { AgentArchitectureAdoptionAuthority, AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import {
  HARNESS_FACTORY_HOLDOUT_STATUSES,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES,
  HARNESS_FACTORY_RESEARCH_TARGETS,
  HarnessFactory,
  isTrustedHarnessFactoryResearchAgendaReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function reconstructedCandidate(fixture, recommendation) {
  return new AgentArchitectureCandidate({
    id: recommendation.baseline.architecture.architectureId,
    description: 'operator-reconstructed candidate for research agenda checks',
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: recommendation.baseline.architecture.components
  });
}

function holdoutBudgets(maxCases = 1) {
  return {
    holdoutProductionBudget: new EvaluationBudget({ maxCases }),
    holdoutResearchBudget: new EvaluationBudget({ maxCases }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases })
  };
}

function failedHoldoutCase() {
  return new AgentPlannerCase({
    id: 'harness-factory-research-agenda-second-holdout-case',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'harness-factory-research-agenda-second-holdout-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'harness-factory-research-agenda-second-holdout-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (report) => report?.completed === true
      && report.cycles?.[0]?.action?.result?.path?.join('>') === 'A>C'
  });
}

function transferGapCase() {
  return new AgentPlannerCase({
    id: 'harness-factory-research-agenda-transfer-gap-case',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'harness-factory-research-agenda-transfer-gap-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'harness-factory-research-agenda-transfer-gap-task',
      description: 'Find a graph path'
    },
    adversarial: false,
    productionEligible: false,
    expected: (report) => report?.completed === true
      && report.cycles?.[0]?.action?.result?.path?.join('>') === 'A>C'
  });
}

function skepticWeaknessCase() {
  return new AgentPlannerCase({
    id: 'harness-factory-research-agenda-skeptic-case',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'harness-factory-research-agenda-skeptic-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'harness-factory-research-agenda-skeptic-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (report) => report?.completed === true
      && report.cycles?.[0]?.action?.result?.path?.join('>') === 'A>C'
  });
}

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-agenda-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const empty = emptyFixture.factory.researchAgenda();
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(empty), true);
assert.equal(Object.isFrozen(empty), true);
assert.equal(empty.recommendationStatus, HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY);
assert.equal(empty.consideredTargetCount, 0);
assert.deepEqual(empty.items, []);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-agenda',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
fixture.factory.manufacture({
  goal: 'create a generation with an untested holdout',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const before = fixture.ledger.serialize();
const validationAgenda = fixture.factory.researchAgenda();
assert.equal(validationAgenda.recommendationStatus, HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT);
assert.equal(validationAgenda.items.length, 1);
assert.equal(validationAgenda.items[0].target, HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT);
assert.equal(validationAgenda.items[0].holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN);
assert.equal(validationAgenda.items[0].rank, 1);
assert.equal(validationAgenda.items[0].validationArchive, null);
assert.equal(Object.hasOwn(validationAgenda.items[0], 'candidate'), false);
assert.equal(Object.hasOwn(validationAgenda.items[0], 'runner'), false);
assert.equal(Object.hasOwn(validationAgenda.items[0], 'actionReport'), false);
assert.equal(validationAgenda.dataOnly, true);
assert.equal(validationAgenda.authorityTransferred, false);
assert.equal(fixture.ledger.serialize(), before);

const recommendation = fixture.factory.recommend();
const validation = fixture.factory.validateRecommendation(recommendation, {
  candidate: reconstructedCandidate(fixture, recommendation),
  holdoutCases: [fixture.holdoutCase],
  ...holdoutBudgets()
});
const archivedValidation = fixture.factory.archiveValidation(validation);
const improvementAgenda = fixture.factory.researchAgenda();
assert.equal(improvementAgenda.recommendationStatus, HARNESS_FACTORY_RECOMMENDATION_STATUSES.IMPROVE_LATEST_GENERATION);
assert.equal(improvementAgenda.consideredGenerationCount, 1);
assert.equal(improvementAgenda.consideredValidationCount, 1);
assert.equal(improvementAgenda.consideredTargetCount, 1);
assert.equal(improvementAgenda.items[0].target, HARNESS_FACTORY_RESEARCH_TARGETS.IMPROVE_LATEST_GENERATION);
assert.equal(improvementAgenda.items[0].holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED);
assert.deepEqual(improvementAgenda.items[0].validationArchive, archivedValidation.archive);
assert.equal(improvementAgenda.complete, true);

const failedFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-agenda-failed',
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
const mainCases = [failedFixture.evaluationCase];
assert.throws(
  () => failedFixture.factory.manufacture({
    goal: 'record an unresolved failed holdout for the agenda',
    plannerCandidates: [failedFixture.partialPlannerCandidate],
    cases: mainCases,
    holdoutCases: [failedHoldoutCase()],
    ...holdoutBudgets(),
    productionBudget: new EvaluationBudget({ maxCases: 2 }),
    researchBudget: new EvaluationBudget({ maxCases: 2 }),
    skepticBudget: new EvaluationBudget({ maxCases: 2 })
  }),
  /holdout benchmark rejected/
);
const recoveryAgenda = failedFixture.factory.researchAgenda({ maxItems: 1 });
assert.equal(recoveryAgenda.recommendationStatus, HARNESS_FACTORY_RECOMMENDATION_STATUSES.RECOVER_FAILED_HOLDOUT);
assert.equal(recoveryAgenda.items.length, 1);
assert.equal(recoveryAgenda.items[0].target, HARNESS_FACTORY_RESEARCH_TARGETS.RECOVER_FAILED_HOLDOUT);
assert.equal(recoveryAgenda.items[0].holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED);
assert.equal(recoveryAgenda.items[0].rank, 1);
assert.equal(recoveryAgenda.truncated, false);

const transferFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-agenda-transfer',
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
const transferReport = transferFixture.factory.manufacture({
  goal: 'record a transfer gap for the agenda',
  plannerCandidates: [transferFixture.plannerCandidate],
  cases: [transferFixture.evaluationCase, transferGapCase()],
  holdoutCases: [transferFixture.holdoutCase],
  productionBudget: new EvaluationBudget({ maxCases: 2 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 2 }),
  ...holdoutBudgets()
});
assert.equal(transferReport.status, 'ADOPTED');
assert.equal(transferReport.holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED);
assert.equal(transferReport.fitness.transferSuccessRate, 0.5);
const transferAgenda = transferFixture.factory.researchAgenda({ maxItems: 1 });
assert.equal(transferAgenda.consideredTargetCount, 2);
assert.equal(transferAgenda.returnedItemCount, 1);
assert.equal(transferAgenda.items[0].target, HARNESS_FACTORY_RESEARCH_TARGETS.TEST_TRANSFER_GAP);
assert.equal(transferAgenda.truncated, true);

const skepticFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-agenda-skeptic',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const skepticReport = skepticFixture.factory.manufacture({
  goal: 'record a skeptic weakness for the agenda',
  plannerCandidates: [skepticFixture.plannerCandidate],
  cases: [skepticWeaknessCase()],
  ...skepticFixture.budgets
});
assert.equal(skepticReport.status, 'REJECTED');
const skepticAgenda = skepticFixture.factory.researchAgenda();
assert.equal(
  skepticAgenda.items.some(
    ({ target }) => target === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_SKEPTIC_WEAKNESS
  ),
  true
);

console.log(
  `FLUID_HARNESS_FACTORY_RESEARCH_AGENDA_OK `
  + `empty=${empty.recommendationStatus} `
  + `validate=${validationAgenda.items[0].target} `
  + `pass=${improvementAgenda.items[0].target} `
  + `recover=${recoveryAgenda.items[0].target} `
  + `transfer=${transferAgenda.items[0].target} `
  + `skeptic=${skepticAgenda.items[1].target} `
  + `archives=${improvementAgenda.items[0].validationArchive.sequence} `
  + `dataOnly=${improvementAgenda.dataOnly} `
  + `authorityTransferred=${improvementAgenda.authorityTransferred}`
);
