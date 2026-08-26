import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryResearchAgendaReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-research-agenda',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect',
  includeFailingPlanner: true
});
const first = fixture.factory.manufacture({
  goal: 'create a generation before benchmark validation research',
  plannerCandidates: [fixture.failingPlannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
assert.equal(first.status, 'REJECTED');
assert.equal(first.archive.sequence, 1);

const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-validation-research-agenda-alternate',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const firstCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-validation-research-agenda-alpha',
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const secondCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-validation-research-agenda-beta',
  plannerCandidate: alternatePlannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'beta' }
});
const campaign = fixture.factory.benchmarkCampaign({
  candidates: [firstCandidate, secondCandidate],
  cases: [fixture.evaluationCase],
  levels: [{
    id: 'benchmark-validation-research-agenda-budget',
    computeUnits: 1,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  }]
});
const archivedCampaign = fixture.factory.archiveBenchmarkCampaign(campaign);

const failedHoldoutCase = new AgentPlannerCase({
  id: 'harness-factory-benchmark-validation-research-agenda-failed-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-validation-research-agenda-failed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-benchmark-validation-research-agenda-failed-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: () => false
});
const validationCandidate = new AgentArchitectureCandidate({
  id: firstCandidate.id,
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const validation = fixture.factory.validateBenchmarkCampaign(archivedCampaign, {
  candidate: validationCandidate,
  levelId: 'benchmark-validation-research-agenda-budget',
  cases: [fixture.evaluationCase],
  holdoutCases: [failedHoldoutCase]
});
const archivedValidation = fixture.factory.archiveBenchmarkCampaignValidation(validation);
assert.equal(archivedValidation.status, 'FAILED');
assert.equal(archivedValidation.archive.sequence, 3);

const beforeAgenda = fixture.ledger.serialize();
const agenda = fixture.factory.researchAgenda();
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(agenda), true);
assert.equal(Object.isFrozen(agenda), true);
assert.equal(Object.isFrozen(agenda.items), true);
assert.equal(agenda.consideredGenerationCount, 1);
assert.equal(agenda.consideredValidationCount, 1);
assert.equal(agenda.consideredTargetCount, 4);
assert.equal(agenda.returnedItemCount, 4);
assert.equal(agenda.truncated, false);
assert.equal(agenda.complete, true);
assert.equal(
  agenda.items[0].target,
  HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
);
assert.equal(agenda.items[0].priority, 460);
assert.equal(agenda.items[0].rank, 1);
assert.equal(agenda.items[0].generation, null);
assert.equal(agenda.items[0].frontierValidation.status, 'INCOMPLETE');
assert.equal(agenda.items[0].frontierValidation.missingPoints.length, 1);
assert.equal(
  agenda.items[1].target,
  HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION
);
assert.equal(agenda.items[1].priority, 450);
assert.equal(agenda.items[1].rank, 2);
assert.equal(agenda.items[1].generation, null);
assert.equal(agenda.items[1].archive.kind, 'harness-factory-benchmark-validation');
assert.equal(agenda.items[1].archive.sequence, archivedValidation.archive.sequence);
assert.deepEqual(agenda.items[1].validationArchive, archivedValidation.archive);
assert.equal(agenda.items[1].holdoutStatus, 'FAILED');
assert.equal(agenda.items[1].benchmarkValidation.candidateId, firstCandidate.id);
assert.equal(agenda.items[1].benchmarkValidation.levelId, 'benchmark-validation-research-agenda-budget');
assert.deepEqual(
  agenda.items[1].benchmarkValidation.campaignArchive,
  archivedCampaign.archive
);
assert.equal(agenda.items[1].benchmarkValidation.status, 'FAILED');
assert.equal(agenda.items[1].benchmarkValidation.passed, false);
assert.equal(Object.isFrozen(agenda.items[1]), true);
assert.equal(Object.isFrozen(agenda.items[1].benchmarkValidation), true);
assert.equal(Object.isFrozen(agenda.items[1].benchmarkValidation.holdout), true);
assert.equal(Object.hasOwn(agenda.items[1], 'candidate'), false);
assert.equal(Object.hasOwn(agenda.items[1], 'runner'), false);
assert.equal(Object.hasOwn(agenda.items[1].benchmarkValidation, 'candidate'), false);
assert.equal(Object.hasOwn(agenda.items[1].benchmarkValidation, 'actionReport'), false);
assert.equal(agenda.items[2].target, HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT);
assert.equal(agenda.items[2].rank, 3);
assert.equal(agenda.items[3].target, HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_SKEPTIC_WEAKNESS);
assert.equal(agenda.items[3].rank, 4);
assert.equal(agenda.dataOnly, true);
assert.equal(agenda.authorityTransferred, false);
assert.equal(fixture.ledger.serialize(), beforeAgenda);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_VALIDATION_RESEARCH_AGENDA_OK `
  + `generations=${agenda.consideredGenerationCount} validations=${agenda.consideredValidationCount} `
  + `targets=${agenda.consideredTargetCount} primary=${agenda.items[0].target} `
  + `validation=${agenda.items[1].holdoutStatus} ledgerUnchanged=${fixture.ledger.serialize() === beforeAgenda} `
  + `dataOnly=${agenda.dataOnly} authorityTransferred=${agenda.authorityTransferred}`
);
