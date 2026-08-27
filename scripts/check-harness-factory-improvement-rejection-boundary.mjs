import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-improvement-rejection-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;
factory.manufacture({
  goal: 'create a baseline for rejection boundary checks',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.throws(
  () => factory.improve({
    goal: 'create a rejection archive',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    memoryQuery: { keywords: ['adopted'] }
  }),
  /did not strictly improve measured fitness/
);

const before = ledger.serialize();
const rejection = factory.improvementRejections().rejections[0];
const forged = { ...rejection, archived: true };
assert.throws(
  () => ledger.appendHarnessFactoryImprovementRejection(forged),
  /trusted report/
);

const accessorReport = {};
Object.defineProperty(accessorReport, 'factoryId', {
  enumerable: true,
  get() {
    return factory.factoryId;
  }
});
assert.throws(
  () => ledger.appendHarnessFactoryImprovementRejection(accessorReport),
  /trusted report/
);

const tamperedArtifact = JSON.parse(before);
tamperedArtifact.records[tamperedArtifact.records.length - 1].payload.candidate.runner = {};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedArtifact)),
  /hash verification failed|invalid shape|invalid candidate|candidate is invalid/
);

const tamperedForeign = JSON.parse(before);
tamperedForeign.records[tamperedForeign.records.length - 1].payload.factoryId = 'foreign-factory';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedForeign)),
  /hash verification failed|baseline identity is invalid|invalid/
);

const tamperedProof = JSON.parse(before);
tamperedProof.records[tamperedProof.records.length - 1].payload.authorityTransferred = true;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedProof)),
  /hash verification failed|proof boundary is invalid/
);

assert.equal(ledger.serialize(), before);
assert.equal(ledger.verify(), true);
assert.equal(factory.improvementRejections().returnedRejectionCount, 1);

console.log(
  `FLUID_HARNESS_FACTORY_IMPROVEMENT_REJECTION_BOUNDARY_OK forgedRejected=true `
  + `accessorRejected=true artifactRejected=true foreignRejected=true proofRejected=true `
  + `ledgerPreserved=true authoritySuppressed=${rejection.authorityTransferred === false}`
);
