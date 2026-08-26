import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkCampaignReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-archive',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-campaign-archive-alternate-planner',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const firstCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-campaign-archive-alpha',
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const secondCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-campaign-archive-beta',
  plannerCandidate: alternatePlannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'beta' }
});
const levels = [{
  id: 'campaign-archive-budget',
  computeUnits: 1,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
}];
const campaign = fixture.factory.benchmarkCampaign({
  candidates: [firstCandidate, secondCandidate],
  cases: [fixture.evaluationCase],
  levels
});
assert.equal(campaign.archived, false);
assert.equal(campaign.archive, null);
const archived = fixture.factory.archiveBenchmarkCampaign(campaign);

assert.equal(isTrustedHarnessFactoryBenchmarkCampaignReport(archived), true);
assert.equal(Object.isFrozen(archived), true);
assert.equal(archived.archived, true);
assert.equal(archived.archive.kind, 'harness-factory-benchmark-campaign');
assert.equal(archived.archive.sequence, 1);
assert.equal(typeof archived.archive.hash, 'string');
assert.equal(Object.isFrozen(archived.archive), true);
assert.equal(fixture.ledger.length, 1);
assert.equal(campaign.archived, false);
assert.equal(campaign.archive, null);

const restored = fixture.ledger.restoreHarnessFactoryBenchmarkCampaigns();
assert.equal(restored.length, 1);
assert.deepEqual(restored[0].candidateIds, archived.candidateIds);
assert.deepEqual(restored[0].caseIds, archived.caseIds);
assert.deepEqual(restored[0].points, archived.points);
assert.deepEqual(restored[0].frontier, archived.frontier);
assert.deepEqual(restored[0].archive, archived.archive);
assert.equal(restored[0].dataOnly, true);
assert.equal(restored[0].deployed, false);
assert.equal(restored[0].authorityTransferred, false);
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignReport(restored[0]), false);
assert.equal(Object.hasOwn(restored[0], 'candidate'), false);
assert.equal(Object.hasOwn(restored[0], 'primary'), false);

const roundTrip = EvidenceLedger.fromSerialized(fixture.ledger.serialize());
assert.deepEqual(
  roundTrip.restoreHarnessFactoryBenchmarkCampaigns(),
  restored
);
assert.equal(roundTrip.verify(), true);

assert.throws(
  () => fixture.factory.archiveBenchmarkCampaign(campaign),
  /already been archived/
);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaign(archived),
  /already been archived/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_ARCHIVE_OK `
  + `recordKind=${archived.archive.kind} sequence=${archived.archive.sequence} `
  + `roundTrip=${roundTrip.verify()} restored=${restored.length} `
  + `dataOnly=${archived.dataOnly} deployed=${archived.deployed} `
  + `authorityTransferred=${archived.authorityTransferred}`
);
