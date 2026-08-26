import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  isTrustedHarnessFactoryBenchmarkCampaignValidationReport,
  isTrustedHarnessFactoryResearchAgendaReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-research-execution',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-validation-research-execution-alternate-planner',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const firstCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-validation-research-execution-alpha',
  description: 'first benchmark validation research architecture',
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const secondCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-validation-research-execution-beta',
  description: 'second benchmark validation research architecture',
  plannerCandidate: alternatePlannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'beta' }
});
const level = {
  id: 'harness-factory-benchmark-validation-research-execution-budget',
  computeUnits: 1,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
};
const campaign = fixture.factory.benchmarkCampaign({
  candidates: [firstCandidate, secondCandidate],
  cases: [fixture.evaluationCase],
  levels: [level]
});
const archivedCampaign = fixture.factory.archiveBenchmarkCampaign(campaign);
const failedHoldoutCase = new AgentPlannerCase({
  id: 'harness-factory-benchmark-validation-research-execution-failed-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-validation-research-execution-failed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-benchmark-validation-research-execution-failed-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: () => false
});
const candidateForFailure = new AgentArchitectureCandidate({
  id: firstCandidate.id,
  description: firstCandidate.description,
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const failedValidation = fixture.factory.validateBenchmarkCampaign(archivedCampaign, {
  candidate: candidateForFailure,
  levelId: level.id,
  cases: [fixture.evaluationCase],
  holdoutCases: [failedHoldoutCase]
});
const archivedFailedValidation = fixture.factory.archiveBenchmarkCampaignValidation(
  failedValidation
);
assert.equal(archivedFailedValidation.status, 'FAILED');
assert.equal(archivedFailedValidation.archive.sequence, 2);

const agenda = fixture.factory.researchAgenda();
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(agenda), true);
const target = agenda.items.find(
  ({ target: itemTarget }) => itemTarget === 'INVESTIGATE_BENCHMARK_VALIDATION'
);
assert.notEqual(target, undefined);
const beforeExecution = fixture.ledger.serialize();
const candidateForRecheck = new AgentArchitectureCandidate({
  id: firstCandidate.id,
  description: firstCandidate.description,
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const rechecked = fixture.factory.executeBenchmarkValidationResearch(target, {
  campaign: archivedCampaign,
  candidate: candidateForRecheck,
  levelId: level.id,
  cases: [fixture.evaluationCase],
  holdoutCases: [fixture.holdoutCase],
  holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(isTrustedHarnessFactoryBenchmarkCampaignValidationReport(rechecked), true);
assert.equal(rechecked.status, 'PASSED');
assert.equal(rechecked.passed, true);
assert.equal(rechecked.archived, true);
assert.equal(rechecked.archive.sequence, 3);
assert.equal(rechecked.campaignArchive.sequence, archivedCampaign.archive.sequence);
assert.equal(rechecked.dataOnly, true);
assert.equal(rechecked.deployed, false);
assert.equal(rechecked.authorityTransferred, false);
assert.equal(fixture.ledger.length, 3);
assert.notEqual(fixture.ledger.serialize(), beforeExecution);

const recoveredAgenda = fixture.factory.researchAgenda();
assert.equal(
  recoveredAgenda.items.some(
    ({ id }) => id === target.id
  ),
  false
);
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(target, {
    campaign: archivedCampaign,
    candidate: new AgentArchitectureCandidate({
      id: firstCandidate.id,
      description: firstCandidate.description,
      plannerCandidate: fixture.plannerCandidate,
      policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
      components: { variant: 'alpha' }
    }),
    levelId: level.id,
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  }),
  /target is stale/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_VALIDATION_RESEARCH_EXECUTION_OK `
  + `target=${target.target} failed=${archivedFailedValidation.status} `
  + `recheck=${rechecked.status} archive=${rechecked.archive.sequence} `
  + `agendaRecovered=${recoveredAgenda.items.length === 0} `
  + `ledgerEntries=${fixture.ledger.length} dataOnly=${rechecked.dataOnly} `
  + `authorityTransferred=${rechecked.authorityTransferred}`
);
