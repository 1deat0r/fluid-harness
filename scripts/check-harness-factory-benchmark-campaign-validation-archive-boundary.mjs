import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkCampaignValidationReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function makeCandidate(fixture, id, plannerCandidate = fixture.plannerCandidate, variant = 'alpha') {
  return new AgentArchitectureCandidate({
    id,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant }
  });
}

function makeLevel(id) {
  return {
    id,
    computeUnits: 1,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

function buildArchivedValidation(fixture, prefix) {
  const alternatePlanner = new AgentPlannerCandidate({
    id: `${prefix}-alternate-planner`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
  const first = makeCandidate(fixture, `${prefix}-alpha`);
  const second = makeCandidate(fixture, `${prefix}-beta`, alternatePlanner, 'beta');
  const level = makeLevel(`${prefix}-level`);
  const campaign = fixture.factory.benchmarkCampaign({
    candidates: [first, second],
    cases: [fixture.evaluationCase],
    levels: [level]
  });
  const archivedCampaign = fixture.factory.archiveBenchmarkCampaign(campaign);
  const validation = fixture.factory.validateBenchmarkCampaign(archivedCampaign, {
    candidate: makeCandidate(fixture, first.id),
    levelId: level.id,
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  });
  return { archivedCampaign, validation };
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-validation-archive-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { archivedCampaign, validation } = buildArchivedValidation(
  fixture,
  'harness-factory-benchmark-campaign-validation-archive-boundary'
);
const before = fixture.ledger.serialize();

const forged = Object.freeze({ ...validation });
const proxied = new Proxy(validation, {});
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignValidationReport(forged), false);
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignValidationReport(proxied), false);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaignValidation(forged),
  /exact validation from this factory/
);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaignValidation(proxied),
  /exact validation from this factory/
);
assert.throws(
  () => fixture.ledger.appendHarnessFactoryBenchmarkValidation(forged),
  /trusted validation report/
);

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-validation-archive-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreign = buildArchivedValidation(
  foreignFixture,
  'harness-factory-benchmark-campaign-validation-archive-boundary-foreign'
);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaignValidation(foreign.validation),
  /exact validation from this factory/
);

const archived = fixture.factory.archiveBenchmarkCampaignValidation(validation);
assert.equal(archived.archived, true);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaignValidation(validation),
  /already been archived/
);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaignValidation(archived),
  /already been archived/
);

const mutableFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-validation-archive-boundary-mutable',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const mutable = buildArchivedValidation(
  mutableFixture,
  'harness-factory-benchmark-campaign-validation-archive-boundary-mutable'
);
Object.defineProperty(mutableFixture.ledger, 'serialize', {
  configurable: true,
  value: () => before
});
assert.throws(
  () => mutableFixture.factory.archiveBenchmarkCampaignValidation(mutable.validation),
  /unmodified evidence ledger instance/
);

const tamperedPayload = JSON.parse(fixture.ledger.serialize());
tamperedPayload.records[1].payload.passed = false;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedPayload)),
  /hash|inconsistent|status/
);

assert.throws(
  () => HarnessFactory.prototype.archiveBenchmarkCampaignValidation.call(
    Object.create(HarnessFactory.prototype),
    archived
  ),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(fixture.factory, {}).archiveBenchmarkCampaignValidation(archived),
  /exact trusted factory/
);

assert.equal(fixture.ledger.serialize() !== before, true);
assert.equal(archived.dataOnly, true);
assert.equal(archived.deployed, false);
assert.equal(archived.authorityTransferred, false);
assert.equal(Object.hasOwn(archived, 'candidate'), false);
assert.equal(Object.hasOwn(archived, 'primary'), false);
assert.equal(Object.hasOwn(archived, 'reproduction'), false);
assert.equal(Object.hasOwn(archived, 'runner'), false);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_ARCHIVE_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true directRejected=true foreignRejected=true `
  + `repeatedRejected=true archivedReportRejected=true mutableRejected=true tamperedRejected=true `
  + `artifactFree=true authoritySuppressed=true`
);
