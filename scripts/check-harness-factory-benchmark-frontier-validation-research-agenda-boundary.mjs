import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
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

function buildCampaign(fixture, factory, prefix) {
  const alternatePlannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-alternate-planner`,
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
  const campaign = factory.archiveBenchmarkCampaign(
    factory.benchmarkCampaign({
      candidates: [alpha, beta],
      cases: [fixture.evaluationCase],
      levels: [level]
    })
  );
  return { alpha, beta, level, campaign };
}

function archiveValidation(fixture, factory, campaign, candidate, level, holdoutCases) {
  const validation = factory.validateBenchmarkCampaign(campaign, {
    candidate,
    levelId: level.id,
    cases: [fixture.evaluationCase],
    holdoutCases
  });
  return factory.archiveBenchmarkCampaignValidation(validation);
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-research-agenda-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const own = buildCampaign(
  fixture,
  fixture.factory,
  'harness-factory-benchmark-frontier-validation-research-agenda-boundary-own'
);
const ownValidation = archiveValidation(
  fixture,
  fixture.factory,
  own.campaign,
  buildCandidate(fixture, own.alpha.id, fixture.plannerCandidate, 'alpha'),
  own.level,
  [fixture.holdoutCase]
);

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-research-agenda-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignFactory = new HarnessFactory({
  factoryId: 'harness-factory-benchmark-frontier-validation-research-agenda-boundary-foreign-factory',
  discoveryRunner: foreignFixture.discoveryRunner,
  ledger: fixture.ledger
});
const foreign = buildCampaign(
  foreignFixture,
  foreignFactory,
  'harness-factory-benchmark-frontier-validation-research-agenda-boundary-foreign'
);
const foreignValidation = archiveValidation(
  foreignFixture,
  foreignFactory,
  foreign.campaign,
  buildCandidate(
    foreignFixture,
    foreign.alpha.id,
    foreignFixture.plannerCandidate,
    'alpha'
  ),
  foreign.level,
  [foreignFixture.holdoutCase]
);

const beforeRead = fixture.ledger.serialize();
const agenda = fixture.factory.researchAgenda();
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(agenda), true);
assert.equal(
  agenda.items.some(
    ({ target }) => target === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
  ),
  true
);
assert.equal(
  agenda.items.every(
    (item) => item.factoryId === fixture.factory.factoryId
      && item.archive.hash !== foreignValidation.archive.hash
  ),
  true
);
const frontierTarget = agenda.items.find(
  ({ target }) => target === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
);
assert.equal(frontierTarget.archive.sequence, ownValidation.archive.sequence);
assert.equal(frontierTarget.frontierValidation.status, 'INCOMPLETE');
assert.equal(frontierTarget.frontierValidation.missingPoints.length, 1);
assert.equal(fixture.ledger.serialize(), beforeRead);

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

const forgedTarget = Object.freeze({ ...frontierTarget });
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(forgedTarget),
  /exact agenda item from this factory/
);
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(new Proxy(frontierTarget, {})),
  /exact agenda item from this factory/
);
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(
    fixture.ledger.restoreHarnessFactoryBenchmarkCampaigns()[0]
  ),
  /exact agenda item from this factory/
);
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(frontierTarget),
  /target is not executable/
);

const mutableFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-research-agenda-boundary-mutable',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const mutableSerialized = mutableFixture.ledger.serialize();
Object.defineProperty(mutableFixture.ledger, 'serialize', {
  configurable: true,
  value: () => mutableSerialized
});
assert.throws(
  () => mutableFixture.factory.researchAgenda(),
  /unmodified evidence ledger instance/
);

const tampered = JSON.parse(beforeRead);
tampered.records[0].payload.factoryId = 'tampered-factory';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|fingerprint/
);
assert.equal(fixture.ledger.serialize(), beforeRead);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_RESEARCH_AGENDA_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true accessorRejected=true `
  + `restoredRejected=true nonExecutableRejected=true foreignExcluded=true `
  + `mutableRejected=true tamperedRejected=true incompleteDetected=true `
  + `ledgerUnchanged=true authoritySuppressed=${agenda.authorityTransferred === false}`
);
