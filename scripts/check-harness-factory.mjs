import assert from 'node:assert/strict';

import {
  HarnessFactory,
  isTrustedHarnessFactory,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-positive',
  includeResearch: true
});
const {
  factory,
  ledger,
  researchContext,
  plannerCandidate,
  evaluationCase,
  budgets
} = fixture;

assert.equal(isTrustedHarnessFactory(factory), true);
assert.equal(factory instanceof HarnessFactory, true);
const report = factory.manufacture({
  goal: 'manufacture a research-informed bounded graph harness',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets,
  researchContext
});

assert.equal(isTrustedHarnessFactoryReport(report), true);
assert.equal(report.factoryId, 'harness-factory-positive-factory');
assert.equal(report.status, 'ADOPTED');
assert.equal(report.complete, true);
assert.equal(report.primaryComplete, true);
assert.equal(report.reproductionComplete, true);
assert.equal(report.reproducible, true);
assert.equal(report.freshAdoption, true);
assert.equal(report.proofStatus, 'PROVEN');
assert.equal(report.proposalCount, 1);
assert.equal(report.builtCandidateCount, 1);
assert.deepEqual(report.proposalIds, ['research-informed-architecture']);
assert.deepEqual(report.candidateIds, ['research-informed-architecture']);
assert.deepEqual(report.retiredCandidateIds, ['research-informed-architecture']);
assert.equal(report.retiredCandidateCount, 1);
assert.equal(report.researchContext.source, 'STRUCTURED_MEMORY');
assert.equal(report.researchContext.resultCount, 1);
assert.equal(report.archive.kind, 'architecture-discovery');
assert.equal(report.archive.sequence, 1);
assert.equal(typeof report.archive.hash, 'string');
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.archive), true);
assert.equal(report.deployed, false);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(ledger.length, 1);
assert.equal(ledger.verify(), true);
const restored = ledger.restoreArchitectureDiscoveries();
assert.equal(restored.length, 1);
assert.equal(restored[0].adopted, true);
assert.equal(restored[0].dataOnly, true);
assert.equal(restored[0].authorityTransferred, false);
assert.equal(Object.hasOwn(report, 'discovery'), false);
assert.equal(Object.hasOwn(report, 'adoption'), false);
assert.equal(Object.hasOwn(report, 'candidate'), false);
assert.equal(Object.hasOwn(report, 'ledger'), false);

console.log(
  `FLUID_HARNESS_FACTORY_OK `
  + `status=${report.status} research=${report.researchContext.source} `
  + `proposals=${report.proposalCount} built=${report.builtCandidateCount} `
  + `retired=${report.retiredCandidateCount} replay=${report.reproducible} `
  + `proof=${report.proofStatus} archive=${report.archive.kind}:${report.archive.sequence} `
  + `deployed=${report.deployed}`
);
