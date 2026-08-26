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

function buildCampaign(fixture, prefix) {
  const alternatePlannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-alternate-planner`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
  const makeCandidate = (id, plannerCandidate, variant) => new AgentArchitectureCandidate({
    id,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant }
  });
  const firstCandidate = makeCandidate(
    `${prefix}-alpha`,
    fixture.plannerCandidate,
    'alpha'
  );
  const secondCandidate = makeCandidate(
    `${prefix}-beta`,
    alternatePlannerCandidate,
    'beta'
  );
  return fixture.factory.benchmarkCampaign({
    candidates: [firstCandidate, secondCandidate],
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
  prefix: 'harness-factory-benchmark-campaign-archive-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const campaign = buildCampaign(
  fixture,
  'harness-factory-benchmark-campaign-archive-boundary'
);
const forgedCampaign = Object.freeze({ ...campaign });
const proxiedCampaign = new Proxy(campaign, {});
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignReport(forgedCampaign), false);
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignReport(proxiedCampaign), false);
const before = fixture.ledger.serialize();
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaign(forgedCampaign),
  /exact campaign from this factory/
);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaign(proxiedCampaign),
  /exact campaign from this factory/
);
assert.throws(
  () => fixture.ledger.appendHarnessFactoryBenchmarkCampaign(forgedCampaign),
  /trusted campaign report/
);
assert.equal(fixture.ledger.serialize(), before);

const archived = fixture.factory.archiveBenchmarkCampaign(campaign);
assert.equal(archived.archived, true);
assert.equal(archived.archive.kind, 'harness-factory-benchmark-campaign');
const afterArchive = fixture.ledger.serialize();
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaign(campaign),
  /already been archived/
);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaign(archived),
  /already been archived/
);

const otherFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-archive-boundary-other',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignCampaign = buildCampaign(
  otherFixture,
  'harness-factory-benchmark-campaign-archive-boundary-foreign'
);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaign(foreignCampaign),
  /exact campaign from this factory/
);

const mutableFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-archive-boundary-mutable',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const mutableCampaign = buildCampaign(
  mutableFixture,
  'harness-factory-benchmark-campaign-archive-boundary-mutable'
);
const mutableBefore = mutableFixture.ledger.serialize();
Object.defineProperty(mutableFixture.ledger, 'serialize', {
  configurable: true,
  value: () => mutableBefore
});
assert.throws(
  () => mutableFixture.factory.archiveBenchmarkCampaign(mutableCampaign),
  /unmodified evidence ledger instance/
);
assert.equal(mutableFixture.ledger.serialize(), mutableBefore);

const tampered = JSON.parse(afterArchive);
tampered.records[0].payload.points[0].productionSuccessRate = 0;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|Pareto|frontier is invalid/
);
assert.throws(
  () => HarnessFactory.prototype.archiveBenchmarkCampaign.call(
    Object.create(HarnessFactory.prototype),
    archived
  ),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(fixture.factory, {}).archiveBenchmarkCampaign(archived),
  /exact trusted factory/
);
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignReport(archived), true);
assert.equal(fixture.ledger.serialize(), afterArchive);
assert.equal(Object.hasOwn(archived, 'candidate'), false);
assert.equal(Object.hasOwn(archived, 'candidates'), false);
assert.equal(Object.hasOwn(archived, 'primary'), false);
assert.equal(Object.hasOwn(archived, 'reproduction'), false);
assert.equal(archived.dataOnly, true);
assert.equal(archived.deployed, false);
assert.equal(archived.authorityTransferred, false);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_ARCHIVE_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true foreignRejected=true `
  + `repeatedRejected=true mutableRejected=true tamperedRejected=true `
  + `ledgerUnchanged=true rawSuppressed=true authoritySuppressed=true`
);
