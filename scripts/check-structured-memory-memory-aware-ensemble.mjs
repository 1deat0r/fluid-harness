import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { MEMORY_SOURCES, memoryFromLedger } from '../src/memory.mjs';
import { buildMemoryAwareAdversarialEnsemble } from './fixtures/memory-aware-adversarial-ensemble.mjs';

const { ledger, report } = buildMemoryAwareAdversarialEnsemble({
  prefix: 'structured-memory-memory-aware-ensemble'
});
ledger.appendMemoryAwareAgentEnsemble(report);
const verifiedLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const memory = memoryFromLedger({ ledger: verifiedLedger });
const retrieval = memory.query({
  source: MEMORY_SOURCES.ENSEMBLE,
  strategyKey: 'memory-aware-agent-ensemble',
  keywords: ['quorum', 'all-proven'],
  limit: 1
});
const entry = retrieval.results[0];

assert.equal(retrieval.resultCount ?? retrieval.returnedCount, 1);
assert.equal(retrieval.results.length, 1);
assert.equal(entry.source, MEMORY_SOURCES.ENSEMBLE);
assert.equal(entry.strategyKey, 'memory-aware-agent-ensemble');
assert.equal(entry.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(entry.dataOnly, true);
assert.equal(entry.historicalOnly, true);
assert.equal(entry.provenance.kind, 'memory-aware-ensemble');
assert.equal(entry.provenance.sequence, 2);
assert.equal(entry.provenance.hash, verifiedLedger.records[1].hash);
assert.equal(Object.isFrozen(memory), true);
assert.equal(Object.isFrozen(entry), true);
assert.equal(Object.isFrozen(entry.provenance), true);
assert.equal(Object.hasOwn(entry, 'members'), false);
assert.equal(Object.hasOwn(entry, 'agents'), false);
assert.equal(Object.hasOwn(entry, 'runReports'), false);
assert.equal(Object.hasOwn(entry, 'actionEvidence'), false);
assert.equal(Object.hasOwn(entry, 'quorumMet'), false);

const coordinationRetrieval = memory.query({
  source: MEMORY_SOURCES.COORDINATION,
  strategyKey: 'memory-aware-agent-ensemble'
});
assert.equal(coordinationRetrieval.results.length, 0);

console.log(
  `FLUID_STRUCTURED_MEMORY_MEMORY_AWARE_ENSEMBLE_OK entries=${memory.size} `
  + `matches=${retrieval.results.length} source=${entry.source} strategy=${entry.strategyKey} `
  + `evidence=${entry.evidence} provenance=${entry.provenance.kind}:${entry.provenance.sequence} `
  + `historicalOnly=${entry.historicalOnly} authoritySuppressed=true`
);
