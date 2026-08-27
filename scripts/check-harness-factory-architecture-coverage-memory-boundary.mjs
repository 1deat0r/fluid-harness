import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-coverage-memory-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;
factory.manufacture({
  goal: 'create coverage memory boundary baseline',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.throws(
  () => factory.improve({
    goal: 'create coverage memory boundary rejection',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    memoryQuery: { keywords: ['adopted'] }
  }),
  /did not strictly improve measured fitness/
);

const before = ledger.serialize();
const coverageSource = MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_COVERAGE;
const memory = memoryFromLedger({
  ledger,
  idPrefix: 'harness-factory-architecture-coverage-memory-boundary'
});
assert.throws(
  () => memory.query({ source: 'NOT_A_MEMORY_SOURCE' }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return coverageSource;
  }
});
assert.throws(
  () => memory.query(accessorQuery),
  /only enumerable data properties/
);
assert.throws(
  () => memory.query({ sources: [coverageSource, coverageSource] }),
  /unique/
);
assert.throws(
  () => memoryFromLedger({ ledger, maxEntries: 2 }),
  /exceeds remaining capacity/
);

const coverageResult = memory.query({ source: coverageSource }).results[0];
assert.equal(coverageResult.dataOnly, true);
assert.equal(coverageResult.historicalOnly, true);
assert.equal(Object.isFrozen(coverageResult), true);
assert.equal(Object.hasOwn(coverageResult, 'attempts'), false);
assert.equal(Object.hasOwn(coverageResult, 'candidate'), false);
assert.equal(Object.hasOwn(coverageResult, 'runner'), false);
assert.equal(Object.hasOwn(coverageResult, 'actionReport'), false);
assert.equal(Object.hasOwn(coverageResult, 'authorityTransferred'), false);

const tampered = JSON.parse(before);
tampered.records[tampered.records.length - 1].payload.candidate.architectureFingerprint = 'forged';
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered))
  }),
  /hash verification failed|invalid candidate|invalid shape|invalid/
);
assert.equal(ledger.serialize(), before);
assert.equal(ledger.verify(), true);
const context = buildStructuredMemoryContext({
  memory,
  query: { source: coverageSource }
});
assert.equal(context.dataOnly, true);
assert.equal(context.historicalOnly, true);
assert.equal(context.authorityTransferred, false);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_MEMORY_BOUNDARY_OK invalidSourceRejected=true `
  + `accessorRejected=true duplicateSourceRejected=true capacityRejected=true `
  + `artifactSuppressed=true tamperedRejected=true ledgerPreserved=true `
  + `historicalOnly=${coverageResult.historicalOnly} authoritySuppressed=${context.authorityTransferred === false}`
);
