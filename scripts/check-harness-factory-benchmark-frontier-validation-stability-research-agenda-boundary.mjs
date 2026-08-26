import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HarnessFactory,
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryResearchAgendaReport
} from '../src/harness-factory.mjs';
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
  prefix: 'harness-factory-benchmark-frontier-validation-stability-research-agenda-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const first = buildCampaign(
  fixture,
  'harness-factory-benchmark-frontier-validation-stability-research-agenda-boundary-repeat'
);
const second = buildCampaign(
  fixture,
  'harness-factory-benchmark-frontier-validation-stability-research-agenda-boundary-repeat'
);
archivePoint(fixture, first.campaign, first.alpha, fixture.plannerCandidate, first.level);
archivePoint(
  fixture,
  first.campaign,
  first.beta,
  first.alternatePlannerCandidate,
  first.level
);
archivePoint(fixture, second.campaign, second.alpha, fixture.plannerCandidate, second.level);

const beforeRead = fixture.ledger.serialize();
const agenda = fixture.factory.researchAgenda();
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(agenda), true);
const stabilityTarget = agenda.items.find(
  ({ target }) => target
    === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
);
assert.notEqual(stabilityTarget, undefined);
assert.equal(stabilityTarget.dataOnly, true);
assert.equal(stabilityTarget.authorityTransferred, false);
assert.equal(stabilityTarget.frontierStability.variablePoints.length, 1);
assert.equal(
  stabilityTarget.frontierStability.variablePoints[0].stabilityStatus,
  'UNSTABLE'
);

const forgedAgenda = Object.freeze({ ...agenda });
const proxiedAgenda = new Proxy(agenda, {});
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(forgedAgenda), false);
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(proxiedAgenda), false);
const accessorAgenda = Object.create(Object.getPrototypeOf(agenda));
Object.defineProperty(accessorAgenda, 'items', {
  configurable: true,
  enumerable: true,
  get: () => agenda.items
});
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(accessorAgenda), false);

const forgedTarget = Object.freeze({ ...stabilityTarget });
const proxiedTarget = new Proxy(stabilityTarget, {});
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(forgedTarget),
  /exact agenda item from this factory/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(proxiedTarget),
  /exact agenda item from this factory/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(stabilityTarget),
  /target is not executable by the frontier bridge/
);

const foreignFactory = new HarnessFactory({
  factoryId: 'harness-factory-benchmark-frontier-validation-stability-research-agenda-boundary-foreign',
  discoveryRunner: fixture.discoveryRunner,
  ledger: EvidenceLedger.fromSerialized(beforeRead)
});
const foreignAgenda = foreignFactory.researchAgenda();
assert.equal(
  foreignAgenda.items.some(
    ({ target }) => target
      === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
  ),
  false
);
assert.equal(foreignAgenda.consideredGenerationCount, 0);
assert.equal(foreignAgenda.consideredValidationCount, 3);

const tampered = JSON.parse(beforeRead);
tampered.records[0].payload.factoryId = 'tampered-factory';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|fingerprint/
);
assert.equal(fixture.ledger.serialize(), beforeRead);

const mutableSerialized = fixture.ledger.serialize();
Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => mutableSerialized
});
assert.throws(
  () => fixture.factory.researchAgenda(),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH_AGENDA_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true accessorRejected=true `
  + `targetForgedRejected=true targetProxiedRejected=true nonExecutableRejected=true `
  + `foreignExcluded=true mutableRejected=true tamperedRejected=true `
  + `ledgerUnchanged=true authoritySuppressed=${agenda.authorityTransferred === false}`
);
