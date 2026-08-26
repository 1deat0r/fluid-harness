import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  HarnessFactory,
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryResearchAgendaReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function buildArchivedValidation(factory, fixture, prefix, holdoutCases) {
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
    holdoutCases
  });
  return {
    campaign: archivedCampaign,
    validation: factory.archiveBenchmarkCampaignValidation(validation)
  };
}

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-research-agenda-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyAgenda = emptyFixture.factory.researchAgenda();
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(emptyAgenda), true);
assert.equal(emptyAgenda.consideredGenerationCount, 0);
assert.equal(emptyAgenda.consideredValidationCount, 0);
assert.equal(emptyAgenda.returnedItemCount, 0);
const forgedAgenda = Object.freeze({ ...emptyAgenda });
const proxiedAgenda = new Proxy(emptyAgenda, {});
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(forgedAgenda), false);
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(proxiedAgenda), false);
assert.throws(
  () => new Proxy(emptyFixture.factory, {}).researchAgenda(),
  /exact trusted factory/
);

const campaignOnlyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-research-agenda-boundary-campaign-only',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const campaignOnlyFailedHoldout = new AgentPlannerCase({
  id: 'harness-factory-benchmark-validation-research-agenda-boundary-campaign-only-failed',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-validation-research-agenda-boundary-campaign-only-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-benchmark-validation-research-agenda-boundary-campaign-only-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: () => false
});
const campaignOnlyValidation = buildArchivedValidation(
  campaignOnlyFixture.factory,
  campaignOnlyFixture,
  'harness-factory-benchmark-validation-research-agenda-boundary-campaign-only',
  [campaignOnlyFailedHoldout]
);
const campaignOnlyAgenda = campaignOnlyFixture.factory.researchAgenda();
assert.equal(campaignOnlyAgenda.recommendationStatus, 'NO_HISTORY');
assert.equal(campaignOnlyAgenda.consideredGenerationCount, 0);
assert.equal(campaignOnlyAgenda.consideredValidationCount, 1);
assert.equal(campaignOnlyAgenda.returnedItemCount, 1);
assert.equal(
  campaignOnlyAgenda.items[0].target,
  HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION
);
assert.equal(campaignOnlyAgenda.items[0].generation, null);
assert.equal(campaignOnlyValidation.validation.status, 'FAILED');

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-research-agenda-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const first = fixture.factory.manufacture({
  goal: 'create a research agenda boundary generation',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
assert.equal(first.status, 'ADOPTED');
const failedHoldoutCase = new AgentPlannerCase({
  id: 'harness-factory-benchmark-validation-research-agenda-boundary-failed-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-validation-research-agenda-boundary-failed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-benchmark-validation-research-agenda-boundary-failed-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: () => false
});
const ownFailed = buildArchivedValidation(
  fixture.factory,
  fixture,
  'harness-factory-benchmark-validation-research-agenda-boundary-own',
  [failedHoldoutCase]
);
const beforeForeign = fixture.ledger.serialize();
const initialAgenda = fixture.factory.researchAgenda();
assert.equal(
  initialAgenda.items.some(
    ({ target }) => target === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION
  ),
  true
);

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-research-agenda-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignFactory = new HarnessFactory({
  factoryId: 'harness-factory-benchmark-validation-research-agenda-boundary-foreign-factory',
  discoveryRunner: foreignFixture.factory.discoveryRunner,
  ledger: fixture.ledger
});
const foreignFailed = buildArchivedValidation(
  foreignFactory,
  foreignFixture,
  'harness-factory-benchmark-validation-research-agenda-boundary-foreign',
  [new AgentPlannerCase({
    id: 'harness-factory-benchmark-validation-research-agenda-boundary-foreign-failed-holdout',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'harness-factory-benchmark-validation-research-agenda-boundary-foreign-failed-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'harness-factory-benchmark-validation-research-agenda-boundary-foreign-failed-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: () => false
  })]
);
const foreignAgenda = fixture.factory.researchAgenda();
assert.equal(
  foreignAgenda.items.filter(
    ({ target }) => target === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION
  ).length,
  1
);
assert.equal(
  foreignAgenda.items.some(
    (item) => item.factoryId === foreignFactory.factoryId
      || item.archive.hash === foreignFailed.validation.archive.hash
  ),
  false
);
assert.equal(foreignAgenda.dataOnly, true);
assert.equal(foreignAgenda.authorityTransferred, false);
assert.equal(foreignAgenda.items[0].benchmarkValidation?.holdout?.candidate, undefined);

const passingHoldout = fixture.holdoutCase;
const ownValidationCandidate = new AgentArchitectureCandidate({
  id: ownFailed.validation.candidateId,
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'alpha' }
});
const ownCampaign = ownFailed.campaign;
const passingValidation = fixture.factory.validateBenchmarkCampaign(ownCampaign, {
  candidate: ownValidationCandidate,
  levelId: ownFailed.validation.levelId,
  cases: [fixture.evaluationCase],
  holdoutCases: [passingHoldout]
});
const ownPassed = fixture.factory.archiveBenchmarkCampaignValidation(passingValidation);
assert.equal(ownPassed.status, 'PASSED');
const recoveredAgenda = fixture.factory.researchAgenda();
assert.equal(
  recoveredAgenda.items.some(
    ({ target, benchmarkValidation }) => target
      === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION
      && benchmarkValidation?.candidateId === ownFailed.validation.candidateId
  ),
  false
);

const beforeTamper = fixture.ledger.serialize();
const tampered = JSON.parse(beforeTamper);
tampered.records[2].payload.status = 'PASSED';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|source/
);
assert.equal(fixture.ledger.serialize(), beforeTamper);
assert.equal(beforeForeign !== beforeTamper, true);

Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => beforeTamper
});
assert.throws(
  () => fixture.factory.researchAgenda(),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_VALIDATION_RESEARCH_AGENDA_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true foreignExcluded=true `
  + `recoveredFailureSuppressed=true mutableRejected=true tamperedRejected=true `
  + `ledgerUnchanged=true authoritySuppressed=true`
);
