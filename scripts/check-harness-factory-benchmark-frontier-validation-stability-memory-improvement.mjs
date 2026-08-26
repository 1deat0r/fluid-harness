import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES,
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

const fixture = buildHarnessFactoryFixture({
  prefix: 'frontier-stability-memory',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromResearch',
  includeFailingPlanner: true
});
const baseline = fixture.factory.manufacture({
  goal: 'create a rejected baseline before frontier-stability memory improvement',
  plannerCandidates: [fixture.failingPlannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
assert.equal(isTrustedHarnessFactoryReport(baseline), true);
assert.equal(baseline.status, HARNESS_FACTORY_STATUSES.REJECTED);

const repeatPrefix = 'harness-factory-benchmark-frontier-validation-stability-memory-repeat';
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
const secondAlphaValidation = archivePoint(
  fixture,
  second.campaign,
  second.alpha,
  fixture.plannerCandidate,
  second.level
);

const beforeMemory = fixture.ledger.serialize();
const memory = memoryFromLedger({
  ledger: EvidenceLedger.fromSerialized(beforeMemory),
  maxEntries: 16,
  idPrefix: 'frontier-stability-memory'
});
const context = buildStructuredMemoryContext({
  memory,
  query: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY,
    keywords: ['frontier-stability-unstable']
  }
});
assert.equal(memory.size, 9);
assert.equal(context.resultCount, 1);
assert.equal(
  context.results[0].source,
  MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY
);
assert.equal(context.results[0].strategyKey, 'harness-factory-benchmark-frontier-validation-stability');
assert.equal(context.results[0].evidence, 'OBSERVED');
assert.equal(context.results[0].historicalOnly, true);
assert.equal(context.results[0].dataOnly, true);
assert.deepEqual(context.results[0].provenance, secondAlphaValidation.archive);
assert.equal(context.results[0].keywords.includes('frontier-stability-unstable'), true);
assert.equal(context.results[0].keywords.includes('frontier-campaigns-2'), true);
assert.equal(context.results[0].keywords.includes('complete-1-of-2'), true);
assert.equal(context.results[0].keywords.includes('reproducible-1-of-2'), true);
assert.equal(context.results[0].keywords.includes('independent-1-of-2'), true);
assert.equal(context.results[0].keywords.includes('variable-points-1'), true);
assert.equal(
  context.results[0].keywords.includes(`factory-${fixture.factory.factoryId}`),
  true
);
assert.equal(Object.hasOwn(context.results[0], 'candidate'), false);
assert.equal(Object.hasOwn(context.results[0], 'runner'), false);
assert.equal(Object.hasOwn(context.results[0], 'actionReport'), false);
assert.equal(fixture.ledger.serialize(), beforeMemory);

const proposal = fixture.proposalRunner.propose({
  goal: 'propose from unstable frontier stability memory',
  plannerCandidateIds: [fixture.plannerCandidate.id],
  researchContext: context
});
assert.equal(proposal.proposals[0].components.researchSource, 'STRUCTURED_MEMORY');
assert.equal(proposal.proposals[0].components.researchResultCount, 1);

const improved = fixture.factory.improve({
  goal: 'improve from unstable frontier stability memory',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets,
  memoryQuery: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY,
    keywords: ['frontier-stability-unstable']
  }
});
assert.equal(isTrustedHarnessFactoryReport(improved), true);
assert.equal(improved.status, HARNESS_FACTORY_STATUSES.ADOPTED);
assert.equal(improved.improvedFromArchive, true);
assert.equal(
  improved.researchContext.query.source,
  MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY
);
assert.equal(improved.researchContext.resultCount, 1);
assert.equal(improved.improvement.accepted, true);
assert.equal(improved.improvement.strictlyImproved, true);

archivePoint(
  fixture,
  second.campaign,
  second.beta,
  second.alternatePlannerCandidate,
  second.level
);
const stableMemory = memoryFromLedger({
  ledger: EvidenceLedger.fromSerialized(fixture.ledger.serialize()),
  maxEntries: 16,
  idPrefix: 'frontier-stability-memory-stable'
});
const stableContext = buildStructuredMemoryContext({
  memory: stableMemory,
  query: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY,
    keywords: ['frontier-stability-stable']
  }
});
assert.equal(stableContext.resultCount, 1);
assert.equal(
  stableContext.results[0].keywords.includes('frontier-stability-stable'),
  true
);
assert.equal(
  stableContext.results[0].keywords.includes('complete-2-of-2'),
  true
);
assert.equal(
  stableContext.results[0].keywords.includes('frontier-stability-unstable'),
  false
);
assert.equal(stableContext.results[0].keywords.includes('variable-points-0'), true);
assert.equal(
  stableContext.results[0].source,
  MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_MEMORY_IMPROVEMENT_OK `
  + `source=${context.query.source} unstableResults=${context.resultCount} `
  + `proposalResults=${proposal.proposals[0].components.researchResultCount} `
  + `improved=${improved.status} strict=${improved.improvement.strictlyImproved} `
  + `stableResults=${stableContext.resultCount} `
  + `stability=${HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE} `
  + `authorityTransferred=${improved.authorityTransferred}`
);
