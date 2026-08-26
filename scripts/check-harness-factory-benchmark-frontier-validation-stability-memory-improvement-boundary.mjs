import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';

function buildCandidate(fixture, id, plannerCandidate, variant) {
  return new AgentArchitectureCandidate({
    id,
    description: `${id} architecture`,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant }
  });
}

function buildCampaign(fixture, prefix) {
  const alternatePlannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-alternate`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
  const alpha = buildCandidate(fixture, `${prefix}-alpha`, fixture.plannerCandidate, 'alpha');
  const beta = buildCandidate(fixture, `${prefix}-beta`, alternatePlannerCandidate, 'beta');
  const level = {
    id: `${prefix}-budget`,
    computeUnits: 1,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
  return {
    alpha,
    beta,
    alternatePlannerCandidate,
    level,
    campaign: fixture.factory.archiveBenchmarkCampaign(
      fixture.factory.benchmarkCampaign({
        candidates: [alpha, beta],
        cases: [fixture.evaluationCase],
        levels: [level]
      })
    )
  };
}

function archivePoint(fixture, campaign, candidate, plannerCandidate, level) {
  return fixture.factory.archiveBenchmarkCampaignValidation(
    fixture.factory.validateBenchmarkCampaign(campaign, {
      candidate: buildCandidate(
        fixture,
        candidate.id,
        plannerCandidate,
        candidate.components.variant
      ),
      levelId: level.id,
      cases: [fixture.evaluationCase],
      holdoutCases: [fixture.holdoutCase]
    })
  );
}

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'frontier-stability-memory-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyMemory = memoryFromLedger({
  ledger: EvidenceLedger.fromSerialized(emptyFixture.ledger.serialize()),
  maxEntries: 8,
  idPrefix: 'frontier-stability-empty'
});
const emptyContext = buildStructuredMemoryContext({
  memory: emptyMemory,
  query: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY
  }
});
assert.equal(emptyContext.resultCount, 0);

const fixture = buildHarnessFactoryFixture({
  prefix: 'frontier-stability-memory-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const repeatPrefix = 'frontier-stability-memory-boundary-repeat';
const first = buildCampaign(fixture, repeatPrefix);
const second = buildCampaign(fixture, repeatPrefix);
archivePoint(fixture, first.campaign, first.alpha, fixture.plannerCandidate, first.level);
archivePoint(
  fixture,
  first.campaign,
  first.beta,
  first.alternatePlannerCandidate,
  first.level
);
archivePoint(fixture, second.campaign, second.alpha, fixture.plannerCandidate, second.level);

const before = fixture.ledger.serialize();
const memory = memoryFromLedger({
  ledger: EvidenceLedger.fromSerialized(before),
  maxEntries: 16,
  idPrefix: 'frontier-stability-boundary'
});
const context = buildStructuredMemoryContext({
  memory,
  query: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY,
    keywords: ['frontier-stability-unstable']
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
  get: () => MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY
});
assert.throws(
  () => buildStructuredMemoryContext({ memory, query: accessorQuery }),
  /only enumerable data properties/
);
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(before),
    maxEntries: 7,
    idPrefix: 'frontier-stability-capacity'
  }),
  /remaining capacity/
);
assert.throws(
  () => fixture.factory.improve({
    goal: 'reject an unsupported stability-memory neighbor source',
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

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_MEMORY_IMPROVEMENT_BOUNDARY_OK `
  + `emptySuppressed=true accessorRejected=true capacityRejected=true `
  + `unsupportedSourceRejected=true tamperedRejected=true `
  + `ledgerUnchanged=true runtimeSuppressed=true authoritySuppressed=true`
);
