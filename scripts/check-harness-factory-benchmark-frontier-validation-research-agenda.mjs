import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryResearchAgendaReport
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
  prefix: 'harness-factory-benchmark-frontier-validation-research-agenda',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-frontier-validation-research-agenda-alternate',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const alpha = buildCandidate(
  fixture,
  'harness-factory-benchmark-frontier-validation-research-agenda-alpha',
  fixture.plannerCandidate,
  'alpha'
);
const beta = buildCandidate(
  fixture,
  'harness-factory-benchmark-frontier-validation-research-agenda-beta',
  alternatePlannerCandidate,
  'beta'
);
const level = {
  id: 'harness-factory-benchmark-frontier-validation-research-agenda-budget',
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
const archivedFirstValidation = fixture.factory.archiveBenchmarkCampaignValidation(
  firstValidation
);
const beforeAgenda = fixture.ledger.serialize();
const incompleteAgenda = fixture.factory.researchAgenda();
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(incompleteAgenda), true);
assert.equal(incompleteAgenda.consideredGenerationCount, 0);
assert.equal(incompleteAgenda.consideredValidationCount, 1);
assert.equal(incompleteAgenda.consideredTargetCount, 1);
assert.equal(incompleteAgenda.returnedItemCount, 1);
assert.equal(incompleteAgenda.items[0].target, HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION);
assert.equal(incompleteAgenda.items[0].priority, 460);
assert.equal(incompleteAgenda.items[0].rank, 1);
assert.equal(incompleteAgenda.items[0].generation, null);
assert.deepEqual(incompleteAgenda.items[0].archive, archivedFirstValidation.archive);
assert.equal(incompleteAgenda.items[0].holdoutStatus, 'INCOMPLETE');
assert.equal(incompleteAgenda.items[0].frontierValidation.frontierCount, 2);
assert.equal(incompleteAgenda.items[0].frontierValidation.coveredCount, 1);
assert.equal(incompleteAgenda.items[0].frontierValidation.missingPoints.length, 1);
assert.equal(incompleteAgenda.items[0].frontierValidation.status, 'INCOMPLETE');
assert.equal(incompleteAgenda.items[0].dataOnly, true);
assert.equal(incompleteAgenda.items[0].authorityTransferred, false);
assert.equal(Object.hasOwn(incompleteAgenda.items[0], 'candidate'), false);
assert.equal(Object.hasOwn(incompleteAgenda.items[0].frontierValidation, 'candidate'), false);
assert.equal(Object.isFrozen(incompleteAgenda.items[0]), true);
assert.equal(Object.isFrozen(incompleteAgenda.items[0].frontierValidation), true);
assert.equal(fixture.ledger.serialize(), beforeAgenda);

const secondValidation = fixture.factory.validateBenchmarkCampaign(archivedCampaign, {
  candidate: buildCandidate(fixture, beta.id, alternatePlannerCandidate, 'beta'),
  levelId: level.id,
  cases: [fixture.evaluationCase],
  holdoutCases: [fixture.holdoutCase]
});
fixture.factory.archiveBenchmarkCampaignValidation(secondValidation);
const completeAgenda = fixture.factory.researchAgenda();
assert.equal(completeAgenda.consideredValidationCount, 2);
assert.equal(
  completeAgenda.items.some(
    ({ target }) => target === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
  ),
  false
);
assert.equal(completeAgenda.returnedItemCount, 0);
assert.equal(completeAgenda.dataOnly, true);
assert.equal(completeAgenda.authorityTransferred, false);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_RESEARCH_AGENDA_OK `
  + `incomplete=${incompleteAgenda.items[0].target} missing=`
  + `${incompleteAgenda.items[0].frontierValidation.missingPoints.length} `
  + `completeSuppressed=${!completeAgenda.items.some(({ target }) => target `
  + `=== HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION)} `
  + `ledgerUnchanged=${fixture.ledger.serialize() !== beforeAgenda} `
  + `dataOnly=${incompleteAgenda.dataOnly} `
  + `authorityTransferred=${incompleteAgenda.authorityTransferred}`
);
