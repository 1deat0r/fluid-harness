import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RECOMMENDATION_STATUSES,
  HarnessFactory,
  isTrustedHarnessFactoryValidationReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function reconstructedCandidate(fixture, recommendation, policy = {}) {
  return new AgentArchitectureCandidate({
    id: recommendation.baseline.architecture.architectureId,
    description: 'boundary-test reconstructed candidate',
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: policy.maxEpisodes ?? 2,
      maxToolCallsPerEpisode: policy.maxToolCallsPerEpisode ?? 2
    }),
    components: recommendation.baseline.architecture.components
  });
}

function validHoldoutBudget() {
  return {
    holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-validation-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyRecommendation = emptyFixture.factory.recommend();
assert.equal(emptyRecommendation.status, HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY);
assert.throws(
  () => emptyFixture.factory.validateRecommendation(emptyRecommendation, {}),
  /VALIDATE_LATEST_HOLDOUT recommendation/
);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-validation-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
fixture.factory.manufacture({
  goal: 'create a generation for validation boundary checks',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const recommendation = fixture.factory.recommend();
assert.equal(
  recommendation.status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
);
const exactCandidate = reconstructedCandidate(fixture, recommendation);
const validOptions = {
  candidate: exactCandidate,
  holdoutCases: [fixture.holdoutCase],
  ...validHoldoutBudget()
};
const validation = fixture.factory.validateRecommendation(recommendation, validOptions);
assert.equal(isTrustedHarnessFactoryValidationReport(validation), true);
assert.equal(validation.archived, false);
assert.equal(validation.authorityTransferred, false);
const forgedValidation = Object.freeze({ ...validation });
const proxiedValidation = new Proxy(validation, {});
assert.equal(isTrustedHarnessFactoryValidationReport(forgedValidation), false);
assert.equal(isTrustedHarnessFactoryValidationReport(proxiedValidation), false);

assert.throws(
  () => fixture.factory.validateRecommendation(forgedValidation, validOptions),
  /exact recommendation from this factory/
);
assert.throws(
  () => fixture.factory.validateRecommendation(proxiedValidation, validOptions),
  /exact recommendation from this factory/
);
const otherFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-validation-boundary-other',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
assert.throws(
  () => otherFixture.factory.validateRecommendation(recommendation, validOptions),
  /exact recommendation from this factory/
);

const plainCandidate = Object.freeze({ ...exactCandidate });
assert.throws(
  () => fixture.factory.validateRecommendation(recommendation, {
    ...validOptions,
    candidate: plainCandidate
  }),
  /requires a trusted candidate/
);
const driftedComponents = new AgentArchitectureCandidate({
  id: recommendation.baseline.architecture.architectureId,
  description: 'boundary-test component drift',
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: {
    ...recommendation.baseline.architecture.components,
    drift: true
  }
});
assert.throws(
  () => fixture.factory.validateRecommendation(recommendation, {
    ...validOptions,
    candidate: driftedComponents
  }),
  /configuration does not match the baseline/
);
const driftedPolicy = reconstructedCandidate(fixture, recommendation, { maxEpisodes: 1 });
assert.throws(
  () => fixture.factory.validateRecommendation(recommendation, {
    ...validOptions,
    candidate: driftedPolicy
  }),
  /fingerprint does not match the baseline/
);
assert.throws(
  () => fixture.factory.validateRecommendation(recommendation, {
    ...validOptions,
    holdoutCases: [fixture.evaluationCase]
  }),
  /overlaps the baseline benchmark/
);
const accessorOptions = {};
Object.defineProperty(accessorOptions, 'candidate', {
  enumerable: true,
  get: () => exactCandidate
});
assert.throws(
  () => fixture.factory.validateRecommendation(recommendation, accessorOptions),
  /only enumerable data properties/
);
const disposedCandidate = reconstructedCandidate(fixture, recommendation);
fixture.factory.dispose({
  candidates: [disposedCandidate],
  reason: 'boundary test disposal'
});
assert.throws(
  () => fixture.factory.validateRecommendation(recommendation, {
    ...validOptions,
    candidate: disposedCandidate
  }),
  /fresh unretired candidate/
);
const fixtureLedgerLength = fixture.ledger.length;
assert.equal(fixtureLedgerLength, 1);

const staleFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-validation-boundary-stale',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
staleFixture.factory.manufacture({
  goal: 'create the stale validation baseline',
  plannerCandidates: [staleFixture.plannerCandidate],
  cases: [staleFixture.evaluationCase],
  ...staleFixture.budgets
});
const staleRecommendation = staleFixture.factory.recommend();
staleFixture.factory.manufacture({
  goal: 'advance the stale validation factory',
  plannerCandidates: [staleFixture.plannerCandidate],
  cases: [staleFixture.evaluationCase],
  ...staleFixture.budgets
});
assert.throws(
  () => staleFixture.factory.validateRecommendation(staleRecommendation, {}),
  /recommendation is stale/
);

const proxyFactory = new Proxy(fixture.factory, {});
assert.throws(
  () => proxyFactory.validateRecommendation(recommendation, validOptions),
  /exact trusted factory/
);
Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => fixture.ledger.serialize()
});
assert.throws(
  () => fixture.factory.validateRecommendation(recommendation, validOptions),
  /unmodified evidence ledger instance/
);
assert.equal(fixture.ledger.length, fixtureLedgerLength);

console.log(
  `FLUID_HARNESS_FACTORY_RECOMMENDATION_VALIDATION_BOUNDARY_OK `
  + `emptyRejected=true forgedReportRejected=true proxiedReportRejected=true `
  + `crossFactoryRejected=true plainCandidateRejected=true componentDriftRejected=true `
  + `policyDriftRejected=true overlapRejected=true accessorRejected=true `
  + `disposedCandidateRejected=true staleRejected=true proxyFactoryRejected=true `
  + `mutableLedgerRejected=true ledgerUnchanged=${fixture.ledger.length === fixtureLedgerLength} `
  + `authoritySuppressed=${validation.authorityTransferred === false}`
);
