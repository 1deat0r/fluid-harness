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

function buildCampaign(fixture, prefix) {
  const alternatePlannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-alternate-planner`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
  const makeCandidate = (id, plannerCandidate, variant) => new AgentArchitectureCandidate({
    id,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: { variant }
  });
  return fixture.factory.benchmarkCampaign({
    candidates: [
      makeCandidate(`${prefix}-alpha`, fixture.plannerCandidate, 'alpha'),
      makeCandidate(`${prefix}-beta`, alternatePlannerCandidate, 'beta')
    ],
    cases: [fixture.evaluationCase],
    levels: [{
      id: `${prefix}-budget`,
      computeUnits: 1,
      productionBudget: new EvaluationBudget({ maxCases: 1 }),
      researchBudget: new EvaluationBudget({ maxCases: 1 }),
      skepticBudget: new EvaluationBudget({ maxCases: 1 })
    }]
  });
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-campaign-memory-improvement',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromResearch',
  includeFailingPlanner: true
});
const first = fixture.factory.manufacture({
  goal: 'create a rejected baseline before campaign-informed improvement',
  plannerCandidates: [fixture.failingPlannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
assert.equal(isTrustedHarnessFactoryReport(first), true);
assert.equal(first.status, HARNESS_FACTORY_STATUSES.REJECTED);
assert.equal(first.generation, 1);
assert.equal(first.archive.sequence, 1);

const campaign = buildCampaign(
  fixture,
  'harness-factory-campaign-memory-improvement'
);
const archivedCampaign = fixture.factory.archiveBenchmarkCampaign(campaign);
assert.equal(archivedCampaign.archive.sequence, 2);

const verifiedLedger = EvidenceLedger.fromSerialized(fixture.ledger.serialize());
const memory = memoryFromLedger({
  ledger: verifiedLedger,
  maxEntries: 8,
  idPrefix: 'harness-factory-campaign-memory'
});
const campaignContext = buildStructuredMemoryContext({
  memory,
  query: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN,
    keywords: ['harness-factory-benchmark-campaign']
  }
});
assert.equal(memory.size, 3);
assert.equal(campaignContext.resultCount, 1);
assert.equal(
  campaignContext.query.source,
  MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN
);
assert.equal(campaignContext.results[0].source, MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN);
assert.equal(campaignContext.results[0].strategyKey, 'harness-factory-benchmark-campaign');
assert.equal(campaignContext.results[0].evidence, 'OBSERVED');
assert.equal(campaignContext.results[0].historicalOnly, true);
assert.equal(campaignContext.results[0].dataOnly, true);
assert.deepEqual(campaignContext.results[0].provenance, archivedCampaign.archive);
assert.equal(campaignContext.results[0].keywords.includes('complete'), true);
assert.equal(campaignContext.results[0].keywords.includes('reproducible'), true);
assert.equal(campaignContext.results[0].keywords.includes('independent'), true);
assert.equal(campaignContext.results[0].keywords.includes('candidates-2'), true);
assert.equal(campaignContext.results[0].keywords.includes('frontier-2'), true);
assert.equal(Object.hasOwn(campaignContext.results[0], 'candidate'), false);
assert.equal(Object.hasOwn(campaignContext.results[0], 'candidates'), false);
assert.equal(Object.hasOwn(campaignContext.results[0], 'runner'), false);
assert.equal(Object.hasOwn(campaignContext.results[0], 'actionReport'), false);

const proposal = fixture.proposalRunner.propose({
  goal: 'propose from archived campaign memory',
  plannerCandidateIds: [fixture.plannerCandidate.id],
  researchContext: campaignContext
});
assert.equal(proposal.proposals[0].components.researchSource, 'STRUCTURED_MEMORY');
assert.equal(proposal.proposals[0].components.researchResultCount, 1);

const beforeImprovement = fixture.ledger.serialize();
const second = fixture.factory.improve({
  goal: 'improve the rejected baseline from campaign evidence',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets,
  memoryQuery: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN,
    keywords: ['harness-factory-benchmark-campaign']
  }
});
assert.equal(isTrustedHarnessFactoryReport(second), true);
assert.equal(second.status, HARNESS_FACTORY_STATUSES.ADOPTED);
assert.equal(second.improvedFromArchive, true);
assert.equal(second.researchContext.query.source, MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN);
assert.equal(second.researchContext.resultCount, 1);
assert.equal(second.improvement.accepted, true);
assert.equal(second.improvement.benchmarkStable, true);
assert.equal(second.improvement.nonRegressing, true);
assert.equal(second.improvement.strictlyImproved, true);
assert.equal(second.improvement.baseline.archive.sequence, 1);
assert.equal(second.generation, 2);
assert.equal(second.archive.sequence, 3);
assert.equal(fixture.ledger.verify(), true);
assert.equal(fixture.ledger.serialize() !== beforeImprovement, true);

const discoveries = fixture.ledger.restoreArchitectureDiscoveries();
assert.equal(discoveries.length, 2);
assert.equal(discoveries[1].proposals[0].components.researchSource, 'STRUCTURED_MEMORY');
assert.equal(discoveries[1].proposals[0].components.researchResultCount, 1);
assert.equal(Object.hasOwn(second, 'memory'), false);
assert.equal(Object.hasOwn(second, 'historicalLedger'), false);
assert.equal(Object.hasOwn(second, 'discovery'), false);
assert.equal(second.dataOnly, true);
assert.equal(second.authorityTransferred, false);

console.log(
  `FLUID_HARNESS_FACTORY_CAMPAIGN_MEMORY_IMPROVEMENT_OK `
  + `campaignSource=${campaignContext.query.source} memoryResults=${campaignContext.resultCount} `
  + `proposalResults=${proposal.proposals[0].components.researchResultCount} `
  + `first=${first.status} second=${second.status} strict=${second.improvement.strictlyImproved} `
  + `archives=${first.archive.sequence},${archivedCampaign.archive.sequence},${second.archive.sequence} `
  + `authorityTransferred=${second.authorityTransferred}`
);
