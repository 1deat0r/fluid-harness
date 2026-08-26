import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkValidationScorecardReport
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
  prefix: 'harness-factory-benchmark-validation-scorecard-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyScorecard = emptyFixture.factory.benchmarkValidationScorecard();
assert.equal(
  isTrustedHarnessFactoryBenchmarkValidationScorecardReport(emptyScorecard),
  true
);
const forgedScorecard = Object.freeze({ ...emptyScorecard });
const proxiedScorecard = new Proxy(emptyScorecard, {});
assert.equal(
  isTrustedHarnessFactoryBenchmarkValidationScorecardReport(forgedScorecard),
  false
);
assert.equal(
  isTrustedHarnessFactoryBenchmarkValidationScorecardReport(proxiedScorecard),
  false
);
assert.throws(
  () => HarnessFactory.prototype.benchmarkValidationScorecard.call(
    Object.create(HarnessFactory.prototype)
  ),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(emptyFixture.factory, {}).benchmarkValidationScorecard(),
  /exact trusted factory/
);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-scorecard-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const own = buildArchivedValidation(
  fixture.factory,
  fixture,
  'harness-factory-benchmark-validation-scorecard-boundary-own'
);

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-scorecard-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignFactory = new HarnessFactory({
  factoryId: 'harness-factory-benchmark-validation-scorecard-boundary-foreign-factory',
  discoveryRunner: foreignFixture.factory.discoveryRunner,
  ledger: fixture.ledger
});
const foreign = buildArchivedValidation(
  foreignFactory,
  foreignFixture,
  'harness-factory-benchmark-validation-scorecard-boundary-foreign'
);
const beforeScorecard = fixture.ledger.serialize();
const scorecard = fixture.factory.benchmarkValidationScorecard();
assert.equal(
  isTrustedHarnessFactoryBenchmarkValidationScorecardReport(scorecard),
  true
);
assert.equal(scorecard.consideredValidationCount, 1);
assert.equal(scorecard.returnedValidationCount, 1);
assert.equal(scorecard.candidateCount, 1);
assert.equal(scorecard.candidateScores[0].candidateId, own.validation.candidateId);
assert.equal(
  scorecard.candidateScores.some(
    ({ candidateId }) => candidateId === foreign.validation.candidateId
  ),
  false
);
assert.equal(fixture.ledger.serialize(), beforeScorecard);
assert.equal(scorecard.dataOnly, true);
assert.equal(scorecard.authorityTransferred, false);
assert.equal(Object.hasOwn(scorecard.candidateScores[0], 'candidate'), false);
assert.equal(Object.hasOwn(scorecard.candidateScores[0], 'candidates'), false);
assert.equal(Object.hasOwn(scorecard.candidateScores[0], 'runner'), false);
assert.equal(Object.hasOwn(scorecard.candidateScores[0], 'actionReport'), false);
assert.equal(Object.hasOwn(scorecard.candidateScores[0], 'holdout'), false);

const tampered = JSON.parse(beforeScorecard);
tampered.records[1].payload.status = 'FAILED';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|source/
);

Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => beforeScorecard
});
assert.throws(
  () => fixture.factory.benchmarkValidationScorecard(),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_VALIDATION_SCORECARD_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true foreignExcluded=true `
  + `mutableRejected=true tamperedRejected=true ledgerUnchanged=true `
  + `artifactFree=true authoritySuppressed=true`
);
