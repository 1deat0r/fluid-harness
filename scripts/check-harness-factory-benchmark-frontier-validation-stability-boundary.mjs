import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityReport
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
  const alternatePlanner = new AgentPlannerCandidate({
    id: `${prefix}-alternate`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
  const alpha = buildCandidate(fixture, `${prefix}-alpha`, fixture.plannerCandidate, 'alpha');
  const beta = buildCandidate(fixture, `${prefix}-beta`, alternatePlanner, 'beta');
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
    alternatePlanner,
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

function archivePoint(fixture, campaign, candidate, plannerCandidate, level, holdoutCases) {
  return fixture.factory.archiveBenchmarkCampaignValidation(
    fixture.factory.validateBenchmarkCampaign(campaign, {
      candidate: buildCandidate(fixture, candidate.id, plannerCandidate, candidate.components.variant),
      levelId: level.id,
      cases: [fixture.evaluationCase],
      holdoutCases
    })
  );
}

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-stability-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyStability = emptyFixture.factory.benchmarkFrontierValidationStability();
assert.equal(
  isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityReport(emptyStability),
  true
);
assert.equal(emptyStability.frontierGroupCount, 0);
assert.equal(emptyStability.returnedValidationCount, 0);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-stability-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const first = buildCampaign(
  fixture,
  'harness-factory-benchmark-frontier-validation-stability-boundary-repeat'
);
const second = buildCampaign(
  fixture,
  'harness-factory-benchmark-frontier-validation-stability-boundary-repeat'
);
archivePoint(fixture, first.campaign, first.alpha, fixture.plannerCandidate, first.level, [fixture.holdoutCase]);
archivePoint(fixture, first.campaign, first.beta, first.alternatePlanner, first.level, [fixture.holdoutCase]);
archivePoint(fixture, second.campaign, second.alpha, fixture.plannerCandidate, second.level, [fixture.holdoutCase]);
const beforeRead = fixture.ledger.serialize();
const stability = fixture.factory.benchmarkFrontierValidationStability();
assert.equal(stability.frontierGroupCount, 1);
assert.equal(stability.unstableFrontierCount, 1);
assert.equal(stability.stableFrontierCount, 0);
assert.equal(stability.frontierScores[0].stabilityStatus, 'UNSTABLE');
assert.equal(stability.frontierScores[0].campaignCount, 2);
assert.equal(stability.frontierScores[0].campaignStatuses.length, 2);
assert.equal(stability.frontierScores[0].stablePointCount, 1);
assert.equal(stability.frontierScores[0].unstablePointCount, 1);
assert.equal(stability.frontierScores[0].insufficientPointCount, 0);
assert.equal(stability.frontierScores[0].pointScores.length, 2);
assert.equal(
  stability.frontierScores[0].pointScores.some(
    ({ stabilityStatus }) => stabilityStatus === 'UNSTABLE'
  ),
  true
);
assert.equal(
  stability.frontierScores[0].pointScores.some(
    ({ stabilityStatus }) => stabilityStatus === 'STABLE'
  ),
  true
);
assert.equal(stability.dataOnly, true);
assert.equal(stability.authorityTransferred, false);
assert.equal(Object.hasOwn(stability.frontierScores[0], 'candidate'), false);
assert.equal(Object.hasOwn(stability.frontierScores[0], 'runner'), false);
assert.equal(Object.hasOwn(stability.frontierScores[0].campaignStatuses[0], 'holdout'), false);
assert.equal(fixture.ledger.serialize(), beforeRead);

const forged = Object.freeze({ ...stability });
const proxied = new Proxy(stability, {});
const accessor = Object.create(Object.getPrototypeOf(stability));
Object.defineProperty(accessor, 'frontierScores', {
  configurable: true,
  enumerable: true,
  get: () => stability.frontierScores
});
assert.equal(isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityReport(forged), false);
assert.equal(isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityReport(proxied), false);
assert.equal(isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityReport(accessor), false);
assert.throws(
  () => HarnessFactory.prototype.benchmarkFrontierValidationStability.call(
    new Proxy(fixture.factory, {})
  ),
  /exact trusted factory/
);

const foreignFactory = new HarnessFactory({
  factoryId: 'harness-factory-benchmark-frontier-validation-stability-boundary-foreign',
  discoveryRunner: fixture.discoveryRunner,
  ledger: EvidenceLedger.fromSerialized(beforeRead)
});
const foreignStability = foreignFactory.benchmarkFrontierValidationStability();
assert.equal(foreignStability.frontierGroupCount, 0);
assert.equal(foreignStability.consideredCampaignCount, 0);

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
  () => fixture.factory.benchmarkFrontierValidationStability(),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_BOUNDARY_OK `
  + `emptyAccepted=true forgedRejected=true proxiedRejected=true accessorRejected=true `
  + `proxyFactoryRejected=true unstableDetected=true foreignExcluded=true `
  + `tamperedRejected=true mutableRejected=true ledgerUnchanged=true `
  + `authoritySuppressed=${stability.authorityTransferred === false}`
);
