import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { MEMORY_SOURCES, memoryFromLedger } from '../src/memory.mjs';
import { buildMemoryAwareAdversarialEnsemble } from './fixtures/memory-aware-adversarial-ensemble.mjs';

const { ledger, report } = buildMemoryAwareAdversarialEnsemble({
  prefix: 'structured-memory-memory-aware-ensemble-boundary'
});
ledger.appendMemoryAwareAgentEnsemble(report);
assert.throws(
  () => memoryFromLedger({ ledger: {} }),
  /trusted evidence ledger/
);
assert.throws(
  () => memoryFromLedger({ ledger, maxEntries: 1 }),
  /capacity|exceeds|remaining/
);
const memory = memoryFromLedger({ ledger });
assert.throws(
  () => memory.query({ source: 'FORGED' }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.ENSEMBLE;
  }
});
assert.throws(
  () => memory.query(accessorQuery),
  /only enumerable data properties/
);
const sourceMismatch = memory.query({
  source: MEMORY_SOURCES.COORDINATION,
  strategyKey: 'memory-aware-agent-ensemble'
});
assert.equal(sourceMismatch.results.length, 0);

const tampered = JSON.parse(ledger.serialize());
tampered.records[1].payload.provenAgents = 0;
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered))
  }),
  /inconsistent|hash verification failed/
);
const artifactQuery = memory.query({
  source: MEMORY_SOURCES.ENSEMBLE,
  strategyKey: 'memory-aware-agent-ensemble'
});
assert.equal(artifactQuery.results.length, 1);
assert.equal(Object.hasOwn(artifactQuery.results[0], 'members'), false);
assert.equal(Object.hasOwn(artifactQuery.results[0], 'agents'), false);
assert.equal(Object.hasOwn(artifactQuery.results[0], 'runReports'), false);
assert.equal(Object.hasOwn(artifactQuery.results[0], 'actionEvidence'), false);
assert.equal(artifactQuery.results[0].dataOnly, true);
assert.equal(artifactQuery.results[0].historicalOnly, true);

console.log(
  `FLUID_STRUCTURED_MEMORY_MEMORY_AWARE_ENSEMBLE_BOUNDARY_OK `
  + `forgedLedgerRejected=true capacityRejected=true invalidSourceRejected=true `
  + `accessorRejected=true sourceMismatch=${sourceMismatch.results.length} `
  + `tamperedRejected=true artifactExposureRejected=true source=${MEMORY_SOURCES.ENSEMBLE} `
  + `historicalOnly=true authoritySuppressed=true`
);
