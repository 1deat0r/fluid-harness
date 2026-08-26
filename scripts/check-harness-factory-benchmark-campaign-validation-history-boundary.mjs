import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkCampaignValidationHistoryReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function buildArchivedValidation(factory, fixture, prefix) {
  const alternatePlannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-alternate-planner`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
  const firstCandidate = new AgentArchitectureCandidate({
    id: `${prefix}-alpha`,
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant: 'alpha' }
  });
  const secondCandidate = new AgentArchitectureCandidate({
    id: `${prefix}-beta`,
    plannerCandidate: alternatePlannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant: 'beta' }
  });
  const level = {
    id: `${prefix}-budget`,
    computeUnits: 1,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
  const campaign = factory.benchmarkCampaign({
    candidates: [firstCandidate, secondCandidate],
    cases: [fixture.evaluationCase],
    levels: [level]
  });
  const archivedCampaign = factory.archiveBenchmarkCampaign(campaign);
  const validationCandidate = new AgentArchitectureCandidate({
    id: firstCandidate.id,
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant: 'alpha' }
  });
  const validation = factory.validateBenchmarkCampaign(archivedCampaign, {
    candidate: validationCandidate,
    levelId: level.id,
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  });
  return {
    campaign: archivedCampaign,
    validation: factory.archiveBenchmarkCampaignValidation(validation)
  };
}

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-validation-history-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyHistory = emptyFixture.factory.benchmarkCampaignValidations();
assert.equal(
  isTrustedHarnessFactoryBenchmarkCampaignValidationHistoryReport(emptyHistory),
  true
);
assert.equal(emptyHistory.consideredValidationCount, 0);
assert.equal(emptyHistory.returnedValidationCount, 0);
const forgedHistory = Object.freeze({ ...emptyHistory });
const proxiedHistory = new Proxy(emptyHistory, {});
assert.equal(
  isTrustedHarnessFactoryBenchmarkCampaignValidationHistoryReport(forgedHistory),
  false
);
assert.equal(
  isTrustedHarnessFactoryBenchmarkCampaignValidationHistoryReport(proxiedHistory),
  false
);
assert.throws(
  () => HarnessFactory.prototype.benchmarkCampaignValidations.call(
    Object.create(HarnessFactory.prototype)
  ),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(emptyFixture.factory, {}).benchmarkCampaignValidations(),
  /exact trusted factory/
);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-validation-history-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const own = buildArchivedValidation(
  fixture.factory,
  fixture,
  'harness-factory-benchmark-campaign-validation-history-boundary-own'
);
const ownHistory = fixture.factory.benchmarkCampaignValidations();
assert.equal(
  isTrustedHarnessFactoryBenchmarkCampaignValidationHistoryReport(ownHistory),
  true
);

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-validation-history-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignFactory = new HarnessFactory({
  factoryId: 'harness-factory-benchmark-campaign-validation-history-boundary-foreign-factory',
  discoveryRunner: foreignFixture.factory.discoveryRunner,
  ledger: fixture.ledger
});
const foreign = buildArchivedValidation(
  foreignFactory,
  foreignFixture,
  'harness-factory-benchmark-campaign-validation-history-boundary-foreign'
);
const beforeHistory = fixture.ledger.serialize();
const history = fixture.factory.benchmarkCampaignValidations();
assert.equal(history.consideredValidationCount, 1);
assert.equal(history.returnedValidationCount, 1);
assert.equal(history.validations[0].factoryId, fixture.factory.factoryId);
assert.equal(history.validations[0].archive.sequence, own.validation.archive.sequence);
assert.equal(
  history.validations.some(({ factoryId }) => factoryId === foreignFactory.factoryId),
  false
);
assert.equal(foreign.validation.factoryId, foreignFactory.factoryId);
assert.equal(fixture.ledger.serialize(), beforeHistory);

assert.equal(history.dataOnly, true);
assert.equal(history.authorityTransferred, false);
assert.equal(Object.hasOwn(history.validations[0], 'candidate'), false);
assert.equal(Object.hasOwn(history.validations[0], 'candidates'), false);
assert.equal(Object.hasOwn(history.validations[0], 'primary'), false);
assert.equal(Object.hasOwn(history.validations[0], 'reproduction'), false);
assert.equal(Object.hasOwn(history.validations[0], 'runner'), false);
assert.equal(Object.hasOwn(history.validations[0], 'actionReport'), false);

const tampered = JSON.parse(beforeHistory);
tampered.records[1].payload.status = 'FAILED';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|source/
);

Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => beforeHistory
});
assert.throws(
  () => fixture.factory.benchmarkCampaignValidations(),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_HISTORY_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true foreignExcluded=true `
  + `mutableRejected=true tamperedRejected=true ledgerUnchanged=true `
  + `artifactFree=true authoritySuppressed=true`
);
