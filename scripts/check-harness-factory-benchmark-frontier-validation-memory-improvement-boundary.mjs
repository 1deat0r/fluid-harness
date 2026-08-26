import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { HarnessFactory } from '../src/harness-factory.mjs';
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

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-memory-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyMemory = memoryFromLedger({
  ledger: EvidenceLedger.fromSerialized(emptyFixture.ledger.serialize()),
  maxEntries: 8,
  idPrefix: 'frontier-memory-empty'
});
const emptyContext = buildStructuredMemoryContext({
  memory: emptyMemory,
  query: { source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION }
});
assert.equal(emptyContext.resultCount, 0);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-memory-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromResearch',
  includeFailingPlanner: true
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-frontier-validation-memory-boundary-alternate',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const alpha = buildCandidate(
  fixture,
  'harness-factory-benchmark-frontier-validation-memory-boundary-alpha',
  fixture.plannerCandidate,
  'alpha'
);
const beta = buildCandidate(
  fixture,
  'harness-factory-benchmark-frontier-validation-memory-boundary-beta',
  alternatePlannerCandidate,
  'beta'
);
const level = {
  id: 'harness-factory-benchmark-frontier-validation-memory-boundary-budget',
  computeUnits: 1,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
};
fixture.factory.manufacture({
  goal: 'create a baseline for frontier-memory boundary checks',
  plannerCandidates: [fixture.failingPlannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const campaign = fixture.factory.archiveBenchmarkCampaign(
  fixture.factory.benchmarkCampaign({
    candidates: [alpha, beta],
    cases: [fixture.evaluationCase],
    levels: [level]
  })
);
fixture.factory.archiveBenchmarkCampaignValidation(
  fixture.factory.validateBenchmarkCampaign(campaign, {
    candidate: buildCandidate(fixture, alpha.id, fixture.plannerCandidate, 'alpha'),
    levelId: level.id,
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  })
);
const before = fixture.ledger.serialize();
const memory = memoryFromLedger({
  ledger: EvidenceLedger.fromSerialized(before),
  maxEntries: 8,
  idPrefix: 'frontier-memory-boundary'
});
const context = buildStructuredMemoryContext({
  memory,
  query: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION
  }
});
assert.equal(context.resultCount, 1);
assert.equal(context.results[0].dataOnly, true);
assert.equal(context.results[0].historicalOnly, true);
assert.equal(Object.hasOwn(context.results[0], 'candidate'), false);
assert.equal(Object.hasOwn(context.results[0], 'candidates'), false);
assert.equal(Object.hasOwn(context.results[0], 'runner'), false);
assert.equal(Object.hasOwn(context.results[0], 'actionReport'), false);
assert.equal(fixture.ledger.serialize(), before);

const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  configurable: true,
  enumerable: true,
  get: () => MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION
});
assert.throws(
  () => buildStructuredMemoryContext({ memory, query: accessorQuery }),
  /only enumerable data properties/
);
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(before),
    maxEntries: 3,
    idPrefix: 'frontier-memory-capacity'
  }),
  /remaining capacity/
);
assert.throws(
  () => fixture.factory.improve({
    goal: 'reject an unsupported frontier-memory neighbor source',
    plannerCandidates: [fixture.plannerCandidate],
    cases: [fixture.evaluationCase],
    ...fixture.budgets,
    memoryQuery: { source: MEMORY_SOURCES.DISTRIBUTION_SHIFT }
  }),
  /must use ARCHITECTURE_DISCOVERY source/
);
assert.equal(fixture.ledger.serialize(), before);

const tampered = JSON.parse(before);
tampered.records[2].payload.holdout.passed = false;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|status/
);
assert.equal(fixture.ledger.serialize(), before);

const forgedLedgerFactory = new HarnessFactory({
  factoryId: 'harness-factory-benchmark-frontier-validation-memory-boundary-forged',
  discoveryRunner: fixture.discoveryRunner,
  ledger: EvidenceLedger.fromSerialized(before)
});
assert.throws(
  () => forgedLedgerFactory.improve({
    goal: 'reject foreign factory frontier memory without a matching generation',
    plannerCandidates: [fixture.plannerCandidate],
    cases: [fixture.evaluationCase],
    ...fixture.budgets,
    memoryQuery: {
      source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION
    }
  }),
  /at least one archived factory generation/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_MEMORY_IMPROVEMENT_BOUNDARY_OK `
  + `emptySuppressed=true accessorRejected=true capacityRejected=true `
  + `unsupportedSourceRejected=true tamperedRejected=true foreignRejected=true `
  + `ledgerUnchanged=true authoritySuppressed=true`
);
