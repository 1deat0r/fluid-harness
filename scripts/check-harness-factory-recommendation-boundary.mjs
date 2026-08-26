import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_HOLDOUT_STATUSES,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES,
  HarnessFactory,
  isTrustedHarnessFactoryRecommendationReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyRecommendation = emptyFixture.factory.recommend();
assert.equal(isTrustedHarnessFactoryRecommendationReport(emptyRecommendation), true);
assert.equal(Object.isFrozen(emptyRecommendation), true);
assert.equal(emptyRecommendation.status, HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY);
assert.equal(emptyRecommendation.dataOnly, true);
assert.equal(emptyRecommendation.authorityTransferred, false);
assert.deepEqual(Object.keys(emptyRecommendation), [
  'factoryId',
  'consideredGenerationCount',
  'status',
  'baseline',
  'baselineGeneration',
  'reason',
  'dataOnly',
  'authorityTransferred'
]);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const report = fixture.factory.manufacture({
  goal: 'create a generation for recommendation boundary checks',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
assert.equal(report.status, 'ADOPTED');
const recommendation = fixture.factory.recommend();
assert.equal(isTrustedHarnessFactoryRecommendationReport(recommendation), true);
assert.equal(recommendation.status, HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT);
assert.equal(recommendation.baselineGeneration, 1);
assert.equal(recommendation.baseline.holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN);
assert.equal(recommendation.dataOnly, true);
assert.equal(recommendation.authorityTransferred, false);
assert.equal(Object.isFrozen(recommendation), true);
assert.equal(Object.isFrozen(recommendation.baseline), true);
assert.equal(Object.isFrozen(recommendation.baseline.architecture), true);
assert.equal(Object.isFrozen(recommendation.baseline.architecture.components), true);
for (const forbiddenKey of [
  'factory',
  'ledger',
  'discovery',
  'candidates',
  'runner',
  'actionReport'
]) {
  assert.equal(Object.prototype.hasOwnProperty.call(recommendation, forbiddenKey), false);
  assert.equal(Object.prototype.hasOwnProperty.call(recommendation.baseline, forbiddenKey), false);
}
assert.throws(
  () => {
    recommendation.baseline.architecture.components.loop = 'mutated';
  },
  TypeError
);
assert.equal(recommendation.baseline.architecture.components.loop, undefined);

const forged = Object.freeze({ ...recommendation });
assert.equal(isTrustedHarnessFactoryRecommendationReport(forged), false);
const proxied = new Proxy(recommendation, {});
assert.equal(isTrustedHarnessFactoryRecommendationReport(proxied), false);
assert.throws(
  () => HarnessFactory.prototype.recommend.call(Object.create(HarnessFactory.prototype)),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(fixture.factory, {}).recommend(),
  /exact trusted factory/
);

const beforeLedgerLength = fixture.ledger.length;
const beforeSerializedLedger = fixture.ledger.serialize();
Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => fixture.ledger.serialize()
});
assert.throws(
  () => fixture.factory.recommend(),
  /unmodified evidence ledger instance/
);
assert.equal(fixture.ledger.length, beforeLedgerLength);
assert.notEqual(fixture.ledger.serialize, undefined);
assert.equal(beforeSerializedLedger.includes('factory'), true);

console.log(
  `FLUID_HARNESS_FACTORY_RECOMMENDATION_BOUNDARY_OK `
  + `emptyFrozen=${Object.isFrozen(emptyRecommendation)} `
  + `forgedRejected=${isTrustedHarnessFactoryRecommendationReport(forged) === false} `
  + `proxiedRejected=${isTrustedHarnessFactoryRecommendationReport(proxied) === false} `
  + `mutableConfigRejected=true `
  + `mutableLedgerRejected=true `
  + `ledgerUnchanged=${fixture.ledger.length === beforeLedgerLength} `
  + `rawSuppressed=${recommendation.baseline.factory === undefined} `
  + `authoritySuppressed=${recommendation.authorityTransferred === false}`
);
