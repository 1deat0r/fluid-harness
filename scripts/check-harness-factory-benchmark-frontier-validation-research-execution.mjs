import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryBenchmarkCampaignValidationReport,
  isTrustedHarnessFactoryBenchmarkFrontierValidationResearchExecutionReport
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
  prefix: 'harness-factory-benchmark-frontier-validation-research-execution',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-frontier-validation-research-execution-alternate',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const alpha = buildCandidate(
  fixture,
  'harness-factory-benchmark-frontier-validation-research-execution-alpha',
  fixture.plannerCandidate,
  'alpha'
);
const beta = buildCandidate(
  fixture,
  'harness-factory-benchmark-frontier-validation-research-execution-beta',
  alternatePlannerCandidate,
  'beta'
);
const level = {
  id: 'harness-factory-benchmark-frontier-validation-research-execution-budget',
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
const firstValidation = fixture.factory.validateBenchmarkCampaign(archivedCampaign, {
  candidate: buildCandidate(fixture, alpha.id, fixture.plannerCandidate, 'alpha'),
  levelId: level.id,
  cases: [fixture.evaluationCase],
  holdoutCases: [fixture.holdoutCase]
});
fixture.factory.archiveBenchmarkCampaignValidation(firstValidation);

const agenda = fixture.factory.researchAgenda();
const target = agenda.items.find(
  ({ target: itemTarget }) => itemTarget
    === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
);
assert.notEqual(target, undefined);
assert.equal(target.frontierValidation.missingPoints.length, 1);
const beforeExecution = fixture.ledger.serialize();
const rechecked = fixture.factory.executeBenchmarkFrontierValidationResearch(target, {
  campaign: archivedCampaign,
  points: [
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

assert.equal(
  isTrustedHarnessFactoryBenchmarkFrontierValidationResearchExecutionReport(rechecked),
  true
);
assert.equal(Object.isFrozen(rechecked), true);
assert.equal(Object.isFrozen(rechecked.validations), true);
assert.equal(Object.isFrozen(rechecked.validationArchives), true);
assert.equal(rechecked.targetId, target.id);
assert.equal(rechecked.campaignArchive.sequence, archivedCampaign.archive.sequence);
assert.equal(rechecked.validationCount, 1);
assert.equal(rechecked.passedCount, 1);
assert.equal(rechecked.failedCount, 0);
assert.equal(rechecked.status, 'PASSED');
assert.equal(rechecked.frontierStatus, 'PASSED');
assert.equal(rechecked.frontierCoverageRate, 1);
assert.equal(rechecked.targetResolved, true);
assert.deepEqual(rechecked.remainingMissingPoints, []);
assert.equal(rechecked.archived, true);
assert.equal(rechecked.validationArchives.length, 1);
assert.equal(rechecked.validationArchives[0].sequence, 3);
assert.equal(rechecked.validations.every(
  (validation) => isTrustedHarnessFactoryBenchmarkCampaignValidationReport(validation)
), true);
assert.equal(rechecked.validations.every(({ archived }) => archived), true);
assert.equal(Object.hasOwn(rechecked, 'candidate'), false);
assert.equal(Object.hasOwn(rechecked.validations[0], 'candidate'), false);
assert.equal(rechecked.dataOnly, true);
assert.equal(rechecked.authorityTransferred, false);
assert.equal(fixture.ledger.length, 3);
assert.notEqual(fixture.ledger.serialize(), beforeExecution);

const recoveredAgenda = fixture.factory.researchAgenda();
assert.equal(
  recoveredAgenda.items.some(
    ({ target: itemTarget }) => itemTarget
      === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
  ),
  false
);
assert.equal(recoveredAgenda.returnedItemCount, 0);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(target, {
    campaign: archivedCampaign,
    points: [
      {
        candidate: buildCandidate(fixture, beta.id, alternatePlannerCandidate, 'beta'),
        levelId: level.id
      }
    ],
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  }),
  /target is stale/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_RESEARCH_EXECUTION_OK `
  + `missing=${target.frontierValidation.missingPoints.length} validated=`
  + `${rechecked.validationCount} passed=${rechecked.passedCount} `
  + `frontierStatus=${rechecked.frontierStatus} targetResolved=${rechecked.targetResolved} `
  + `ledgerEntries=${fixture.ledger.length} dataOnly=${rechecked.dataOnly} `
  + `authorityTransferred=${rechecked.authorityTransferred}`
);
