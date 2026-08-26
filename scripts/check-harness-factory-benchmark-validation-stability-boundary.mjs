import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkValidationStabilityReport
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

function buildCampaign(factory, fixture, prefix) {
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
  return {
    alpha,
    beta,
    level,
    campaign: factory.archiveBenchmarkCampaign(
      factory.benchmarkCampaign({
        candidates: [alpha, beta],
        cases: [fixture.evaluationCase],
        levels: [level]
      })
    )
  };
}

function archiveValidation(factory, fixture, campaign, candidate, level, holdoutCases) {
  return factory.archiveBenchmarkCampaignValidation(
    factory.validateBenchmarkCampaign(campaign, {
      candidate: buildCandidate(
        fixture,
        candidate.id,
        candidate.plannerCandidate,
        candidate.components.variant
      ),
      levelId: level.id,
      cases: [fixture.evaluationCase],
      holdoutCases
    })
  );
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-stability-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const first = buildCampaign(
  fixture.factory,
  fixture,
  'harness-factory-benchmark-validation-stability-boundary-first'
);
const second = buildCampaign(
  fixture.factory,
  fixture,
  'harness-factory-benchmark-validation-stability-boundary-first'
);
archiveValidation(fixture.factory, fixture, first.campaign, first.alpha, first.level, [fixture.holdoutCase]);
archiveValidation(fixture.factory, fixture, second.campaign, second.alpha, second.level, [fixture.holdoutCase]);

const betaFailed = new AgentArchitectureCandidate({
  id: first.beta.id,
  description: first.beta.description,
  plannerCandidate: first.beta.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: { variant: 'beta' }
});
const betaFailureCase = new AgentPlannerCase({
  id: 'harness-factory-benchmark-validation-stability-boundary-failed-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-benchmark-validation-stability-boundary-failed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-benchmark-validation-stability-boundary-failed-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: () => false
});
archiveValidation(
  fixture.factory,
  fixture,
  first.campaign,
  betaFailed,
  first.level,
  [betaFailureCase]
);
archiveValidation(
  fixture.factory,
  fixture,
  second.campaign,
  first.beta,
  second.level,
  [fixture.holdoutCase]
);

const before = fixture.ledger.serialize();
const stability = fixture.factory.benchmarkValidationStability();
assert.equal(isTrustedHarnessFactoryBenchmarkValidationStabilityReport(stability), true);
assert.equal(isTrustedHarnessFactoryBenchmarkValidationStabilityReport({ ...stability }), false);
assert.equal(isTrustedHarnessFactoryBenchmarkValidationStabilityReport(new Proxy(stability, {})), false);
assert.equal(stability.candidateCount, 2);
assert.equal(stability.stableCandidateCount, 1);
assert.equal(stability.candidateScores[0].stabilityStatus, 'STABLE');
assert.equal(stability.candidateScores[0].campaignCount, 2);
assert.equal(stability.candidateScores[1].stabilityStatus, 'UNSTABLE');
assert.equal(stability.candidateScores[1].campaignCount, 2);
assert.equal(stability.candidateScores[1].passedCount, 1);
assert.equal(stability.candidateScores[1].failedCount, 1);
assert.equal(stability.dataOnly, true);
assert.equal(stability.authorityTransferred, false);
assert.equal(Object.hasOwn(stability.candidateScores[0], 'candidate'), false);
assert.equal(Object.hasOwn(stability.candidateScores[0], 'holdout'), false);
assert.equal(fixture.ledger.serialize(), before);

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-stability-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignFactory = new HarnessFactory({
  factoryId: 'harness-factory-benchmark-validation-stability-boundary-foreign-factory',
  discoveryRunner: foreignFixture.factory.discoveryRunner,
  ledger: fixture.ledger
});
const foreign = buildCampaign(
  foreignFactory,
  foreignFixture,
  'harness-factory-benchmark-validation-stability-boundary-foreign'
);
archiveValidation(
  foreignFactory,
  foreignFixture,
  foreign.campaign,
  foreign.alpha,
  foreign.level,
  [foreignFixture.holdoutCase]
);
const afterForeign = fixture.factory.benchmarkValidationStability();
assert.equal(afterForeign.consideredValidationCount, 4);
assert.equal(afterForeign.candidateCount, 2);
assert.equal(
  afterForeign.candidateScores.some(
    ({ candidateId }) => candidateId === foreign.alpha.id
  ),
  false
);

const serializedBeforeTamper = fixture.ledger.serialize();
const tampered = JSON.parse(serializedBeforeTamper);
tampered.records[4].payload.status = 'PASSED';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|source/
);
assert.equal(fixture.ledger.serialize(), serializedBeforeTamper);

Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => serializedBeforeTamper
});
assert.throws(
  () => fixture.factory.benchmarkValidationStability(),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true stableDetected=true `
  + `unstableDetected=true foreignExcluded=true tamperedRejected=true `
  + `mutableRejected=true ledgerUnchanged=true artifactFree=true `
  + `authoritySuppressed=${stability.authorityTransferred === false}`
);
