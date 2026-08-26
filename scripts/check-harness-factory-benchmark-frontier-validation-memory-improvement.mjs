import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_STATUSES,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
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
  prefix: 'frontier-memory-improvement',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromResearch',
  includeFailingPlanner: true
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-frontier-validation-memory-improvement-alternate',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const alpha = buildCandidate(
  fixture,
  'harness-factory-benchmark-frontier-validation-memory-improvement-alpha',
  fixture.plannerCandidate,
  'alpha'
);
const beta = buildCandidate(
  fixture,
  'harness-factory-benchmark-frontier-validation-memory-improvement-beta',
  alternatePlannerCandidate,
  'beta'
);
const level = {
  id: 'harness-factory-benchmark-frontier-validation-memory-improvement-budget',
  computeUnits: 1,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
};
const baseline = fixture.factory.manufacture({
  goal: 'create a rejected baseline before frontier-memory improvement',
  plannerCandidates: [fixture.failingPlannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
assert.equal(isTrustedHarnessFactoryReport(baseline), true);
assert.equal(baseline.status, HARNESS_FACTORY_STATUSES.REJECTED);
assert.equal(baseline.archive.sequence, 1);

const archivedCampaign = fixture.factory.archiveBenchmarkCampaign(
  fixture.factory.benchmarkCampaign({
    candidates: [alpha, beta],
    cases: [fixture.evaluationCase],
    levels: [level]
  })
);
const archivedFirstValidation = fixture.factory.archiveBenchmarkCampaignValidation(
  fixture.factory.validateBenchmarkCampaign(archivedCampaign, {
    candidate: buildCandidate(fixture, alpha.id, fixture.plannerCandidate, 'alpha'),
    levelId: level.id,
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  })
);
assert.equal(archivedCampaign.archive.sequence, 2);
assert.equal(archivedFirstValidation.archive.sequence, 3);

const verifiedLedger = EvidenceLedger.fromSerialized(fixture.ledger.serialize());
const incompleteMemory = memoryFromLedger({
  ledger: verifiedLedger,
  maxEntries: 8,
  idPrefix: 'harness-factory-benchmark-frontier-validation-memory'
});
const incompleteContext = buildStructuredMemoryContext({
  memory: incompleteMemory,
  query: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION,
    keywords: ['frontier-validation-incomplete']
  }
});
assert.equal(incompleteMemory.size, 4);
assert.equal(incompleteContext.resultCount, 1);
assert.equal(
  incompleteContext.results[0].source,
  MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION
);
assert.equal(incompleteContext.results[0].strategyKey, 'harness-factory-benchmark-frontier-validation');
assert.equal(incompleteContext.results[0].evidence, 'OBSERVED');
assert.equal(incompleteContext.results[0].historicalOnly, true);
assert.equal(incompleteContext.results[0].dataOnly, true);
assert.deepEqual(incompleteContext.results[0].provenance, archivedFirstValidation.archive);
assert.equal(incompleteContext.results[0].keywords.includes('coverage-1-of-2'), true);
assert.equal(incompleteContext.results[0].keywords.includes('duplicates-0'), true);
assert.equal(incompleteContext.results[0].keywords.includes('incomplete'), true);
assert.equal(incompleteContext.results[0].keywords.includes('dependent'), true);
assert.equal(
  incompleteContext.results[0].keywords.includes(
    `factory-${fixture.factory.factoryId}`
  ),
  true
);
assert.equal(Object.hasOwn(incompleteContext.results[0], 'candidate'), false);
assert.equal(Object.hasOwn(incompleteContext.results[0], 'candidates'), false);
assert.equal(Object.hasOwn(incompleteContext.results[0], 'runner'), false);
assert.equal(Object.hasOwn(incompleteContext.results[0], 'actionReport'), false);

const proposal = fixture.proposalRunner.propose({
  goal: 'propose from incomplete frontier validation memory',
  plannerCandidateIds: [fixture.plannerCandidate.id],
  researchContext: incompleteContext
});
assert.equal(proposal.proposals[0].components.researchSource, 'STRUCTURED_MEMORY');
assert.equal(proposal.proposals[0].components.researchResultCount, 1);

const beforeImprovement = fixture.ledger.serialize();
const improved = fixture.factory.improve({
  goal: 'improve the rejected baseline from frontier validation memory',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets,
  memoryQuery: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION,
    keywords: ['frontier-validation-incomplete']
  }
});
assert.equal(isTrustedHarnessFactoryReport(improved), true);
assert.equal(improved.status, HARNESS_FACTORY_STATUSES.ADOPTED);
assert.equal(improved.improvedFromArchive, true);
assert.equal(
  improved.researchContext.query.source,
  MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION
);
assert.equal(improved.researchContext.resultCount, 1);
assert.equal(improved.improvement.accepted, true);
assert.equal(improved.improvement.strictlyImproved, true);
assert.equal(improved.generation, 2);
assert.equal(improved.archive.sequence, 4);
assert.notEqual(fixture.ledger.serialize(), beforeImprovement);

const archivedSecondValidation = fixture.factory.archiveBenchmarkCampaignValidation(
  fixture.factory.validateBenchmarkCampaign(archivedCampaign, {
    candidate: buildCandidate(fixture, beta.id, alternatePlannerCandidate, 'beta'),
    levelId: level.id,
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  })
);
const completeMemory = memoryFromLedger({
  ledger: EvidenceLedger.fromSerialized(fixture.ledger.serialize()),
  maxEntries: 8,
  idPrefix: 'harness-factory-benchmark-frontier-validation-memory-complete'
});
const completeContext = buildStructuredMemoryContext({
  memory: completeMemory,
  query: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION,
    keywords: ['frontier-validation-passed']
  }
});
assert.equal(completeContext.resultCount, 1);
assert.equal(completeContext.results[0].keywords.includes('coverage-2-of-2'), true);
assert.equal(completeContext.results[0].keywords.includes('validations-2'), true);
assert.equal(completeContext.results[0].keywords.includes('duplicates-0'), true);
assert.equal(completeContext.results[0].keywords.includes('frontier-validation-passed'), true);
assert.deepEqual(completeContext.results[0].provenance, archivedSecondValidation.archive);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_MEMORY_IMPROVEMENT_OK `
  + `source=${incompleteContext.query.source} incompleteCoverage=1/2 `
  + `completeCoverage=2/2 memoryResults=${incompleteContext.resultCount} `
  + `proposalResults=${proposal.proposals[0].components.researchResultCount} `
  + `first=${baseline.status} second=${improved.status} strict=${improved.improvement.strictlyImproved} `
  + `archives=${baseline.archive.sequence},${archivedCampaign.archive.sequence},`
  + `${archivedFirstValidation.archive.sequence},${improved.archive.sequence},`
  + `${archivedSecondValidation.archive.sequence} authorityTransferred=${improved.authorityTransferred}`
);
