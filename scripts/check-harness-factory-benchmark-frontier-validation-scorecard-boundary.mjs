import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkFrontierValidationScorecardReport
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

function archiveOneValidation(fixture, factory, campaign, candidate, level, holdoutCase) {
  const validation = factory.validateBenchmarkCampaign(campaign, {
    candidate,
    levelId: level.id,
    cases: [fixture.evaluationCase],
    holdoutCases: [holdoutCase]
  });
  return factory.archiveBenchmarkCampaignValidation(validation);
}

function buildCampaign(fixture, factory, prefix) {
  const alternatePlannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-alternate-planner`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
  const alpha = buildCandidate(
    fixture,
    `${prefix}-alpha`,
    fixture.plannerCandidate,
    'alpha'
  );
  const beta = buildCandidate(
    fixture,
    `${prefix}-beta`,
    alternatePlannerCandidate,
    'beta'
  );
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

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-scorecard-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const own = buildCampaign(
  fixture,
  fixture.factory,
  'harness-factory-benchmark-frontier-validation-scorecard-boundary-own'
);
archiveOneValidation(
  fixture,
  fixture.factory,
  own.campaign,
  buildCandidate(fixture, own.alpha.id, fixture.plannerCandidate, 'alpha'),
  own.level,
  fixture.holdoutCase
);
const beforeForeign = fixture.ledger.serialize();

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-scorecard-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignFactory = new HarnessFactory({
  factoryId: 'harness-factory-benchmark-frontier-validation-scorecard-boundary-foreign-factory',
  discoveryRunner: foreignFixture.discoveryRunner,
  ledger: fixture.ledger
});
const foreign = buildCampaign(
  foreignFixture,
  foreignFactory,
  'harness-factory-benchmark-frontier-validation-scorecard-boundary-foreign'
);
archiveOneValidation(
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
  foreignFixture.holdoutCase
);

const scorecard = fixture.factory.benchmarkFrontierValidationScorecard();
assert.equal(isTrustedHarnessFactoryBenchmarkFrontierValidationScorecardReport(scorecard), true);
assert.equal(scorecard.consideredBatchCount, 1);
assert.equal(scorecard.returnedBatchCount, 1);
assert.equal(scorecard.consideredValidationCount, 1);
assert.equal(scorecard.returnedValidationCount, 1);
assert.equal(scorecard.batchScores[0].frontierCount, 2);
assert.equal(scorecard.batchScores[0].coveredCount, 1);
assert.equal(scorecard.batchScores[0].status, 'INCOMPLETE');
assert.equal(scorecard.batchScores[0].missingPoints.length, 1);
assert.equal(fixture.ledger.serialize() !== beforeForeign, true);

const forged = Object.freeze({ ...scorecard });
assert.equal(isTrustedHarnessFactoryBenchmarkFrontierValidationScorecardReport(forged), false);
assert.equal(
  isTrustedHarnessFactoryBenchmarkFrontierValidationScorecardReport(new Proxy(scorecard, {})),
  false
);
const accessorReport = Object.create(Object.getPrototypeOf(scorecard));
Object.defineProperty(accessorReport, 'factoryId', {
  configurable: true,
  enumerable: true,
  get: () => scorecard.factoryId
});
assert.equal(
  isTrustedHarnessFactoryBenchmarkFrontierValidationScorecardReport(accessorReport),
  false
);
const restoredCampaign = fixture.ledger.restoreHarnessFactoryBenchmarkCampaigns()[0];
assert.equal(
  isTrustedHarnessFactoryBenchmarkFrontierValidationScorecardReport(restoredCampaign),
  false
);

const mutableFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-scorecard-boundary-mutable',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const mutableSerialized = mutableFixture.ledger.serialize();
Object.defineProperty(mutableFixture.ledger, 'serialize', {
  configurable: true,
  value: () => mutableSerialized
});
assert.throws(
  () => mutableFixture.factory.benchmarkFrontierValidationScorecard(),
  /unmodified evidence ledger instance/
);

const tampered = JSON.parse(beforeForeign);
tampered.records[0].payload.factoryId = 'tampered-factory';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|fingerprint/
);
assert.equal(fixture.ledger.serialize() !== beforeForeign, true);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true accessorRejected=true `
  + `restoredRejected=true foreignExcluded=true mutableRejected=true `
  + `tamperedRejected=true incompleteDetected=true ledgerUnchanged=true `
  + `authoritySuppressed=${scorecard.authorityTransferred === false}`
);
