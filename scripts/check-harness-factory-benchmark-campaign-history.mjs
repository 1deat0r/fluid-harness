import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import {
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
  prefix: 'harness-factory-benchmark-campaign-history-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyHistory = emptyFixture.factory.benchmarkCampaigns();
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignHistoryReport(emptyHistory), true);
assert.equal(Object.isFrozen(emptyHistory), true);
assert.equal(emptyHistory.consideredCampaignCount, 0);
assert.equal(emptyHistory.returnedCampaignCount, 0);
assert.equal(emptyHistory.truncated, false);
assert.deepEqual(emptyHistory.campaigns, []);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-history',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const campaign = buildCampaign(
  fixture,
  'harness-factory-benchmark-campaign-history'
);
const archived = fixture.factory.archiveBenchmarkCampaign(campaign);
for (let index = 1; index < 33; index += 1) {
  fixture.ledger.appendHarnessFactoryBenchmarkCampaign(archived);
}
const beforeHistory = fixture.ledger.serialize();
const history = fixture.factory.benchmarkCampaigns();

assert.equal(isTrustedHarnessFactoryBenchmarkCampaignHistoryReport(history), true);
assert.equal(Object.isFrozen(history), true);
assert.equal(Object.isFrozen(history.campaigns), true);
assert.equal(history.factoryId, fixture.factory.factoryId);
assert.equal(history.consideredCampaignCount, 33);
assert.equal(history.returnedCampaignCount, 32);
assert.equal(history.maxEntries, 32);
assert.equal(history.truncated, true);
assert.equal(Object.isFrozen(history.campaigns[0]), true);
assert.equal(Object.isFrozen(history.campaigns[0].archive), true);
assert.equal(Object.isFrozen(history.campaigns[0].points), true);
assert.equal(Object.isFrozen(history.campaigns[0].frontier), true);
assert.equal(history.campaigns[0].factoryId, fixture.factory.factoryId);
assert.equal(history.campaigns[0].archive.sequence, 2);
assert.equal(
  history.campaigns[history.campaigns.length - 1].archive.sequence,
  33
);
assert.equal(history.campaigns[0].dataOnly, true);
assert.equal(history.campaigns[0].deployed, false);
assert.equal(history.campaigns[0].authorityTransferred, false);
assert.equal(Object.hasOwn(history.campaigns[0], 'candidate'), false);
assert.equal(Object.hasOwn(history.campaigns[0], 'candidates'), false);
assert.equal(Object.hasOwn(history.campaigns[0], 'primary'), false);
assert.equal(Object.hasOwn(history.campaigns[0], 'reproduction'), false);
assert.equal(Object.hasOwn(history.campaigns[0], 'reproducibility'), false);
assert.equal(Object.hasOwn(history.campaigns[0].points[0], 'actionReport'), false);
assert.equal(Object.hasOwn(history.campaigns[0].points[0], 'runner'), false);
assert.equal(history.dataOnly, true);
assert.equal(history.authorityTransferred, false);
assert.equal(fixture.ledger.serialize(), beforeHistory);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_OK `
  + `considered=${history.consideredCampaignCount} returned=${history.returnedCampaignCount} `
  + `truncated=${history.truncated} sequence=${history.campaigns[0].archive.sequence}-`
  + `${history.campaigns[history.campaigns.length - 1].archive.sequence} `
  + `ledgerUnchanged=${fixture.ledger.serialize() === beforeHistory} `
  + `dataOnly=${history.dataOnly} authorityTransferred=${history.authorityTransferred}`
);
