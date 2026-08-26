import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES,
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
  prefix: 'harness-factory-benchmark-frontier-validation-stability-research-agenda',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const first = buildCampaign(
  fixture,
  'harness-factory-benchmark-frontier-validation-stability-research-agenda-repeat'
);
const second = buildCampaign(
  fixture,
  'harness-factory-benchmark-frontier-validation-stability-research-agenda-repeat'
);
archivePoint(fixture, first.campaign, first.alpha, fixture.plannerCandidate, first.level);
archivePoint(
  fixture,
  first.campaign,
  first.beta,
  first.alternatePlannerCandidate,
  first.level
);
const secondAlphaValidation = archivePoint(
  fixture,
  second.campaign,
  second.alpha,
  fixture.plannerCandidate,
  second.level
);

const beforeAgenda = fixture.ledger.serialize();
const unstableAgenda = fixture.factory.researchAgenda();
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(unstableAgenda), true);
assert.equal(unstableAgenda.consideredGenerationCount, 0);
assert.equal(unstableAgenda.consideredValidationCount, 3);
assert.equal(unstableAgenda.consideredTargetCount, 2);
assert.equal(unstableAgenda.returnedItemCount, 2);
const incompleteTarget = unstableAgenda.items.find(
  ({ target }) => target
    === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
);
const stabilityTarget = unstableAgenda.items.find(
  ({ target }) => target
    === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
);
assert.notEqual(incompleteTarget, undefined);
assert.notEqual(stabilityTarget, undefined);
assert.equal(incompleteTarget.rank, 1);
assert.equal(stabilityTarget.rank, 2);
assert.equal(stabilityTarget.priority, 455);
assert.equal(stabilityTarget.generation, null);
assert.equal(stabilityTarget.archive.sequence, second.campaign.archive.sequence);
assert.equal(stabilityTarget.validationArchive.sequence, secondAlphaValidation.archive.sequence);
assert.equal(
  stabilityTarget.holdoutStatus,
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
);
assert.equal(stabilityTarget.frontierStability.frontierCount, 2);
assert.equal(stabilityTarget.frontierStability.validationCount, 3);
assert.equal(stabilityTarget.frontierStability.campaignCount, 2);
assert.equal(stabilityTarget.frontierStability.passedCount, 1);
assert.equal(stabilityTarget.frontierStability.incompleteCount, 1);
assert.equal(stabilityTarget.frontierStability.passRate, 0.5);
assert.equal(stabilityTarget.frontierStability.completeCount, 1);
assert.equal(stabilityTarget.frontierStability.reproducibleCount, 1);
assert.equal(stabilityTarget.frontierStability.independentCount, 1);
assert.equal(stabilityTarget.frontierStability.stable, false);
assert.equal(
  stabilityTarget.frontierStability.stabilityStatus,
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
);
assert.equal(stabilityTarget.frontierStability.campaignStatuses.length, 2);
assert.match(stabilityTarget.reason, /unstable/);
assert.equal(stabilityTarget.dataOnly, true);
assert.equal(stabilityTarget.authorityTransferred, false);
assert.equal(Object.isFrozen(stabilityTarget), true);
assert.equal(Object.isFrozen(stabilityTarget.benchmark), true);
assert.equal(Object.isFrozen(stabilityTarget.frontierStability), true);
assert.equal(Object.isFrozen(stabilityTarget.frontierStability.campaignStatuses), true);
assert.equal(Object.hasOwn(stabilityTarget, 'candidate'), false);
assert.equal(Object.hasOwn(stabilityTarget.frontierStability, 'campaign'), false);
assert.equal(Object.hasOwn(stabilityTarget.frontierStability.campaignStatuses[0], 'holdout'), false);
assert.equal(fixture.ledger.serialize(), beforeAgenda);

archivePoint(
  fixture,
  second.campaign,
  second.beta,
  second.alternatePlannerCandidate,
  second.level
);
const recoveredAgenda = fixture.factory.researchAgenda();
assert.equal(
  recoveredAgenda.items.some(
    ({ target }) => target
      === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
  ),
  false
);
assert.equal(
  recoveredAgenda.items.some(
    ({ target }) => target
      === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
  ),
  false
);
assert.equal(recoveredAgenda.returnedItemCount, 0);
assert.equal(recoveredAgenda.dataOnly, true);
assert.equal(recoveredAgenda.authorityTransferred, false);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH_AGENDA_OK `
  + `unstableDetected=${stabilityTarget.frontierStability.stabilityStatus} `
  + `priority=${stabilityTarget.priority} campaigns=`
  + `${stabilityTarget.frontierStability.campaignCount} incompleteSuppressed=`
  + `${!recoveredAgenda.items.some(({ target }) => target `
  + `=== HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION)} `
  + `stabilitySuppressed=${!recoveredAgenda.items.some(({ target }) => target `
  + `=== HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY)} `
  + `ledgerUnchanged=${fixture.ledger.serialize() !== beforeAgenda} `
  + `dataOnly=${unstableAgenda.dataOnly} authorityTransferred=${unstableAgenda.authorityTransferred}`
);
