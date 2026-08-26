import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  isTrustedHarnessFactoryBenchmarkCampaignValidationReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-validation-archive',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-campaign-validation-archive-alternate-planner',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const firstCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-campaign-validation-archive-alpha',
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const secondCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-campaign-validation-archive-beta',
  plannerCandidate: alternatePlannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'beta' }
});
const level = {
  id: 'validation-archive-budget',
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

function matchingCandidate() {
  return new AgentArchitectureCandidate({
    id: firstCandidate.id,
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant: 'alpha' }
  });
}

const passingValidation = fixture.factory.validateBenchmarkCampaign(archivedCampaign, {
  candidate: matchingCandidate(),
  levelId: level.id,
  cases: [fixture.evaluationCase],
  holdoutCases: [fixture.holdoutCase]
});
const archivedPassing = fixture.factory.archiveBenchmarkCampaignValidation(passingValidation);

assert.equal(isTrustedHarnessFactoryBenchmarkCampaignValidationReport(archivedPassing), true);
assert.equal(archivedPassing.archived, true);
assert.equal(archivedPassing.archive.kind, 'harness-factory-benchmark-validation');
assert.equal(archivedPassing.archive.sequence, 2);
assert.equal(fixture.ledger.length, 2);
assert.equal(passingValidation.archived, false);
assert.equal(passingValidation.archive, null);
assert.equal(archivedPassing.status, 'PASSED');
assert.equal(archivedPassing.passed, true);
assert.equal(archivedPassing.dataOnly, true);
assert.equal(archivedPassing.deployed, false);
assert.equal(archivedPassing.authorityTransferred, false);
assert.equal(Object.hasOwn(archivedPassing, 'candidate'), false);
assert.equal(Object.hasOwn(archivedPassing, 'primary'), false);
assert.equal(Object.hasOwn(archivedPassing, 'reproduction'), false);
assert.equal(Object.hasOwn(archivedPassing, 'runner'), false);

const failedHoldoutCase = new AgentPlannerCase({
  id: 'harness-factory-benchmark-campaign-validation-archive-failed-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-campaign-validation-archive-failed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-benchmark-campaign-validation-archive-failed-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: () => false
});
const failedValidation = fixture.factory.validateBenchmarkCampaign(archivedCampaign, {
  candidate: matchingCandidate(),
  levelId: level.id,
  cases: [fixture.evaluationCase],
  holdoutCases: [failedHoldoutCase]
});
const archivedFailed = fixture.factory.archiveBenchmarkCampaignValidation(failedValidation);
assert.equal(archivedFailed.status, 'FAILED');
assert.equal(archivedFailed.passed, false);
assert.equal(archivedFailed.archive.sequence, 3);

const restored = fixture.ledger.restoreHarnessFactoryBenchmarkValidations();
assert.equal(restored.length, 2);
assert.deepEqual(restored[0].campaignArchive, archivedCampaign.archive);
assert.deepEqual(restored[0].campaignPoint, passingValidation.campaignPoint);
assert.deepEqual(restored[0].benchmarkPoint, passingValidation.benchmarkPoint);
assert.equal(restored[0].status, 'PASSED');
assert.equal(restored[1].status, 'FAILED');
assert.equal(restored[0].dataOnly, true);
assert.equal(restored[0].deployed, false);
assert.equal(restored[0].authorityTransferred, false);
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignValidationReport(restored[0]), false);
assert.equal(Object.hasOwn(restored[0], 'candidate'), false);
assert.equal(Object.hasOwn(restored[0], 'primary'), false);

const roundTrip = EvidenceLedger.fromSerialized(fixture.ledger.serialize());
assert.equal(roundTrip.verify(), true);
assert.deepEqual(roundTrip.restoreHarnessFactoryBenchmarkValidations(), restored);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaignValidation(passingValidation),
  /already been archived/
);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaignValidation(archivedPassing),
  /already been archived/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_ARCHIVE_OK `
  + `campaign=${archivedCampaign.archive.sequence} validations=${restored.length} `
  + `records=${fixture.ledger.length} statuses=${restored.map(({ status }) => status).join(',')} `
  + `roundTrip=${roundTrip.verify()} dataOnly=${archivedPassing.dataOnly} `
  + `authorityTransferred=${archivedPassing.authorityTransferred}`
);
