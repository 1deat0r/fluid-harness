import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
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

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-memory-improvement',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromBenchmarkValidationMemory',
  includeFailingPlanner: true
});
const first = fixture.factory.manufacture({
  goal: 'create a rejected baseline before validation-informed improvement',
  plannerCandidates: [fixture.failingPlannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
assert.equal(isTrustedHarnessFactoryReport(first), true);
assert.equal(first.status, HARNESS_FACTORY_STATUSES.REJECTED);
assert.equal(first.generation, 1);
assert.equal(first.archive.sequence, 1);

const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-validation-memory-improvement-alternate-planner',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const firstCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-validation-memory-improvement-alpha',
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const secondCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-validation-memory-improvement-beta',
  plannerCandidate: alternatePlannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'beta' }
});
const level = {
  id: 'benchmark-validation-memory-budget',
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
assert.equal(archivedCampaign.archive.sequence, 2);

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
const archivedPassing = fixture.factory.archiveBenchmarkCampaignValidation(
  passingValidation
);

const failedHoldoutCase = new AgentPlannerCase({
  id: 'harness-factory-benchmark-validation-memory-improvement-failed-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-validation-memory-improvement-failed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-benchmark-validation-memory-improvement-failed-task',
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
const archivedFailed = fixture.factory.archiveBenchmarkCampaignValidation(
  failedValidation
);
assert.equal(archivedPassing.status, 'PASSED');
assert.equal(archivedFailed.status, 'FAILED');
assert.equal(archivedFailed.archive.sequence, 4);

const verifiedLedger = EvidenceLedger.fromSerialized(fixture.ledger.serialize());
const memory = memoryFromLedger({
  ledger: verifiedLedger,
  maxEntries: 8,
  idPrefix: 'harness-factory-benchmark-validation-memory'
});
const validationContext = buildStructuredMemoryContext({
  memory,
  query: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION,
    keywords: ['validation-failed']
  }
});
assert.equal(memory.size, 5);
assert.equal(validationContext.resultCount, 1);
assert.equal(
  validationContext.query.source,
  MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION
);
assert.equal(
  validationContext.results[0].source,
  MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION
);
assert.equal(validationContext.results[0].strategyKey, 'harness-factory-benchmark-validation');
assert.equal(validationContext.results[0].architectureId, firstCandidate.id);
assert.equal(validationContext.results[0].evidence, 'OBSERVED');
assert.equal(validationContext.results[0].historicalOnly, true);
assert.equal(validationContext.results[0].dataOnly, true);
assert.deepEqual(validationContext.results[0].provenance, archivedFailed.archive);
assert.equal(validationContext.results[0].keywords.includes('validation-failed'), true);
assert.equal(validationContext.results[0].keywords.includes('holdout-failed'), true);
assert.equal(Object.hasOwn(validationContext.results[0], 'candidate'), false);
assert.equal(Object.hasOwn(validationContext.results[0], 'holdout'), false);
assert.equal(Object.hasOwn(validationContext.results[0], 'runner'), false);
assert.equal(Object.hasOwn(validationContext.results[0], 'actionReport'), false);

const proposal = fixture.proposalRunner.propose({
  goal: 'propose from archived benchmark validation memory',
  plannerCandidateIds: [fixture.failingPlannerCandidate.id, fixture.plannerCandidate.id],
  researchContext: validationContext
});
assert.equal(proposal.proposals[0].plannerCandidateId, fixture.plannerCandidate.id);
assert.equal(proposal.proposals[0].components.priorValidationStatus, 'failed');
assert.equal(proposal.proposals[0].components.priorValidationResultCount, 1);
assert.equal(
  proposal.proposals[0].components.researchSource,
  'STRUCTURED_MEMORY'
);

const beforeImprovement = fixture.ledger.serialize();
const second = fixture.factory.improve({
  goal: 'improve after a failed benchmark holdout validation',
  plannerCandidates: [fixture.failingPlannerCandidate, fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets,
  memoryQuery: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION,
    keywords: ['validation-failed']
  }
});
assert.equal(isTrustedHarnessFactoryReport(second), true);
assert.equal(second.status, HARNESS_FACTORY_STATUSES.ADOPTED);
assert.equal(second.improvedFromArchive, true);
assert.equal(
  second.researchContext.query.source,
  MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION
);
assert.equal(second.researchContext.resultCount, 1);
assert.equal(second.improvement.accepted, true);
assert.equal(second.improvement.strictlyImproved, true);
assert.equal(second.improvement.baseline.archive.sequence, 1);
assert.equal(second.generation, 2);
assert.equal(second.archive.sequence, 5);
assert.equal(fixture.ledger.verify(), true);
assert.notEqual(fixture.ledger.serialize(), beforeImprovement);

const discoveries = fixture.ledger.restoreArchitectureDiscoveries();
assert.equal(discoveries.length, 2);
assert.equal(
  discoveries[1].proposals[0].components.priorValidationStatus,
  'failed'
);
assert.equal(
  discoveries[1].proposals[0].components.researchSource,
  'STRUCTURED_MEMORY'
);
assert.equal(Object.hasOwn(second, 'memory'), false);
assert.equal(Object.hasOwn(second, 'historicalLedger'), false);
assert.equal(Object.hasOwn(second, 'discovery'), false);
assert.equal(second.dataOnly, true);
assert.equal(second.authorityTransferred, false);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_VALIDATION_MEMORY_IMPROVEMENT_OK `
  + `validationSource=${validationContext.query.source} memoryResults=${validationContext.resultCount} `
  + `proposalCandidate=${proposal.proposals[0].plannerCandidateId} `
  + `validationStatus=${proposal.proposals[0].components.priorValidationStatus} `
  + `first=${first.status} second=${second.status} strict=${second.improvement.strictlyImproved} `
  + `archives=${first.archive.sequence},${archivedCampaign.archive.sequence},`
  + `${archivedPassing.archive.sequence},${archivedFailed.archive.sequence},${second.archive.sequence} `
  + `authorityTransferred=${second.authorityTransferred}`
);
