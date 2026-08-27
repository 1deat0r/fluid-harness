import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryArchitectureCoverageReport
} from '../src/harness-factory.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-coverage-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;
factory.manufacture({
  goal: 'create coverage boundary baseline',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.throws(
  () => factory.improve({
    goal: 'create a rejected coverage attempt',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    memoryQuery: { keywords: ['adopted'] }
  }),
  /did not strictly improve measured fitness/
);

const before = ledger.serialize();
const coverage = factory.architectureCoverage();
const forgedCoverage = { ...coverage, authorityTransferred: true };
assert.equal(isTrustedHarnessFactoryArchitectureCoverageReport(forgedCoverage), false);

const proxyFactory = new Proxy(factory, {});
assert.throws(
  () => proxyFactory.architectureCoverage(),
  /exact trusted factory/
);
const accessorFactory = Object.create(Object.getPrototypeOf(factory));
Object.defineProperty(accessorFactory, 'factoryId', {
  enumerable: true,
  get() {
    return factory.factoryId;
  }
});
assert.throws(
  () => factory.architectureCoverage.call(accessorFactory),
  /exact trusted factory/
);

const artifactPayload = JSON.parse(before);
artifactPayload.records[artifactPayload.records.length - 1].payload.candidate.runner = {};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(artifactPayload)),
  /hash verification failed|invalid candidate|invalid shape|candidate is invalid/
);

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-coverage-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignReport = foreignFixture.factory.manufacture({
  goal: 'create a foreign coverage attempt',
  plannerCandidates: [foreignFixture.plannerCandidate],
  cases: [foreignFixture.evaluationCase],
  ...foreignFixture.budgets
});
const foreignDiscovery = foreignFixture.discoveryRunner.discover({
  goal: 'create a foreign coverage attempt',
  plannerCandidates: [foreignFixture.plannerCandidate],
  cases: [foreignFixture.evaluationCase],
  productionBudget: foreignFixture.budgets.productionBudget,
  researchBudget: foreignFixture.budgets.researchBudget,
  skepticBudget: foreignFixture.budgets.skepticBudget
});
ledger.appendArchitectureDiscovery(
  foreignDiscovery,
  foreignReport.factoryMetadata
);
const afterForeign = ledger.serialize();
const scopedCoverage = factory.architectureCoverage();
assert.equal(scopedCoverage.consideredAttemptCount, 2);
assert.equal(scopedCoverage.returnedAttemptCount, 2);
assert.equal(scopedCoverage.factoryId, factory.factoryId);
assert.equal(ledger.verify(), true);
assert.notEqual(afterForeign, before);
assert.equal(
  scopedCoverage.attempts.every((attempt) => Object.hasOwn(attempt, 'runner') === false),
  true
);
assert.equal(
  scopedCoverage.attempts.every((attempt) => Object.hasOwn(attempt, 'candidate') === false),
  true
);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_BOUNDARY_OK forgedRejected=true `
  + `proxyRejected=true accessorRejected=true artifactRejected=true foreignExcluded=true `
  + `ledgerPreserved=${ledger.verify()} authoritySuppressed=${scopedCoverage.authorityTransferred === false}`
);
