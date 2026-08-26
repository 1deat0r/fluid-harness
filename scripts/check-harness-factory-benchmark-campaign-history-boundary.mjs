import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkCampaignHistoryReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
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

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-history-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyHistory = emptyFixture.factory.benchmarkCampaigns();
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignHistoryReport(emptyHistory), true);
assert.equal(emptyHistory.consideredCampaignCount, 0);
assert.equal(emptyHistory.returnedCampaignCount, 0);
const forgedHistory = Object.freeze({ ...emptyHistory });
const proxiedHistory = new Proxy(emptyHistory, {});
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignHistoryReport(forgedHistory), false);
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignHistoryReport(proxiedHistory), false);
assert.throws(
  () => HarnessFactory.prototype.benchmarkCampaigns.call(
    Object.create(HarnessFactory.prototype)
  ),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(emptyFixture.factory, {}).benchmarkCampaigns(),
  /exact trusted factory/
);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-history-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const campaign = buildCampaign(
  fixture,
  'harness-factory-benchmark-campaign-history-boundary'
);
const archived = fixture.factory.archiveBenchmarkCampaign(campaign);
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignHistoryReport(
  fixture.factory.benchmarkCampaigns()
), true);

const otherFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-history-boundary-other',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignCampaign = buildCampaign(
  otherFixture,
  'harness-factory-benchmark-campaign-history-boundary-foreign'
);
fixture.ledger.appendHarnessFactoryBenchmarkCampaign(foreignCampaign);
const beforeHistory = fixture.ledger.serialize();
const history = fixture.factory.benchmarkCampaigns();
assert.equal(history.consideredCampaignCount, 1);
assert.equal(history.returnedCampaignCount, 1);
assert.equal(history.campaigns[0].factoryId, fixture.factory.factoryId);
assert.equal(history.campaigns[0].archive.sequence, archived.archive.sequence);
assert.equal(history.campaigns.some(
  ({ factoryId }) => factoryId === otherFixture.factory.factoryId
), false);
assert.equal(fixture.ledger.serialize(), beforeHistory);

assert.equal(history.dataOnly, true);
assert.equal(history.authorityTransferred, false);
assert.equal(Object.hasOwn(history.campaigns[0], 'candidate'), false);
assert.equal(Object.hasOwn(history.campaigns[0], 'candidates'), false);
assert.equal(Object.hasOwn(history.campaigns[0], 'primary'), false);
assert.equal(Object.hasOwn(history.campaigns[0], 'reproduction'), false);
assert.equal(Object.hasOwn(history.campaigns[0], 'reproducibility'), false);
assert.equal(Object.hasOwn(history.campaigns[0].points[0], 'actionReport'), false);
assert.equal(Object.hasOwn(history.campaigns[0].points[0], 'runner'), false);

const tampered = JSON.parse(beforeHistory);
tampered.records[0].payload.points[0].productionSuccessRate = 0;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|Pareto|frontier/
);

Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => beforeHistory
});
assert.throws(
  () => fixture.factory.benchmarkCampaigns(),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true foreignExcluded=true `
  + `mutableRejected=true tamperedRejected=true ledgerUnchanged=true `
  + `artifactFree=true authoritySuppressed=true`
);
