import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  isTrustedHarnessFactoryBenchmarkCampaignValidationReport,
  isTrustedHarnessFactoryBenchmarkFrontierValidationReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function buildCandidate(fixture, id, plannerCandidate, variant) {
  return new AgentArchitectureCandidate({
    id,
    description: `${id} architecture`,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant }
  });
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-frontier-validation',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-campaign-frontier-validation-alternate-planner',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const alpha = buildCandidate(
  fixture,
  'harness-factory-benchmark-campaign-frontier-validation-alpha',
  fixture.plannerCandidate,
  'alpha'
);
const beta = buildCandidate(
  fixture,
  'harness-factory-benchmark-campaign-frontier-validation-beta',
  alternatePlannerCandidate,
  'beta'
);
const level = {
  id: 'harness-factory-benchmark-campaign-frontier-validation-budget',
  computeUnits: 1,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
};
const archivedCampaign = fixture.factory.archiveBenchmarkCampaign(
  fixture.factory.benchmarkCampaign({
    candidates: [alpha, beta],
    cases: [fixture.evaluationCase],
    levels: [level]
  })
);
assert.equal(archivedCampaign.frontier.length, 2);
const beforeValidation = fixture.ledger.serialize();
const frontierValidation = fixture.factory.validateBenchmarkCampaignFrontier({
  campaign: archivedCampaign,
  points: [
    {
      candidate: buildCandidate(fixture, alpha.id, fixture.plannerCandidate, 'alpha'),
      levelId: level.id
    },
    {
      candidate: buildCandidate(fixture, beta.id, alternatePlannerCandidate, 'beta'),
      levelId: level.id
    }
  ],
  cases: [fixture.evaluationCase],
  holdoutCases: [fixture.holdoutCase],
  holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(isTrustedHarnessFactoryBenchmarkFrontierValidationReport(frontierValidation), true);
assert.equal(Object.isFrozen(frontierValidation), true);
assert.equal(Object.isFrozen(frontierValidation.validations), true);
assert.equal(frontierValidation.campaignArchive.sequence, archivedCampaign.archive.sequence);
assert.equal(frontierValidation.validationCount, 2);
assert.equal(frontierValidation.passedCount, 2);
assert.equal(frontierValidation.failedCount, 0);
assert.equal(frontierValidation.status, 'PASSED');
assert.equal(frontierValidation.complete, true);
assert.equal(frontierValidation.reproducible, true);
assert.equal(frontierValidation.independent, true);
assert.equal(frontierValidation.archived, false);
assert.deepEqual(frontierValidation.validationArchives, [null, null]);
assert.equal(frontierValidation.dataOnly, true);
assert.equal(frontierValidation.authorityTransferred, false);
assert.equal(frontierValidation.validations.every(
  (validation) => isTrustedHarnessFactoryBenchmarkCampaignValidationReport(validation)
), true);
assert.equal(frontierValidation.validations.every(({ status }) => status === 'PASSED'), true);
assert.equal(Object.hasOwn(frontierValidation, 'candidate'), false);
assert.equal(Object.hasOwn(frontierValidation.validations[0], 'candidate'), false);
assert.equal(fixture.ledger.serialize(), beforeValidation);

const archivedFrontierValidation = fixture.factory.archiveBenchmarkCampaignFrontierValidations(
  frontierValidation
);
assert.equal(isTrustedHarnessFactoryBenchmarkFrontierValidationReport(archivedFrontierValidation), true);
assert.equal(archivedFrontierValidation.archived, true);
assert.equal(archivedFrontierValidation.validationArchives.length, 2);
assert.equal(archivedFrontierValidation.validationArchives[0].sequence, 2);
assert.equal(archivedFrontierValidation.validationArchives[1].sequence, 3);
assert.equal(archivedFrontierValidation.validations.every(({ archived }) => archived), true);
assert.equal(fixture.ledger.length, 3);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaignFrontierValidations(frontierValidation),
  /already been archived/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_FRONTIER_VALIDATION_OK `
  + `frontier=${frontierValidation.validationCount} passed=${frontierValidation.passedCount} `
  + `archived=${archivedFrontierValidation.archived} archives=`
  + `${archivedFrontierValidation.validationArchives.map(({ sequence }) => sequence).join(',')} `
  + `ledgerEntries=${fixture.ledger.length} dataOnly=${archivedFrontierValidation.dataOnly} `
  + `authorityTransferred=${archivedFrontierValidation.authorityTransferred}`
);
