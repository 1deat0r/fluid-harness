import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { MEMORY_SOURCES, memoryFromLedger } from '../src/memory.mjs';
import { buildMemoryAwareAdversarialEnsemble } from './fixtures/memory-aware-adversarial-ensemble.mjs';

const { ledger, report } = buildMemoryAwareAdversarialEnsemble({
  prefix: 'memory-aware-agent-ensemble-ledger-non-quorum',
  failingMember: 1
});
const record = ledger.appendMemoryAwareAgentEnsemble(report);
const restored = EvidenceLedger.fromSerialized(ledger.serialize());
const ensembles = restored.restoreMemoryAwareAgentEnsembles();
const restoredEnsemble = ensembles[0];
const memory = memoryFromLedger({ ledger: restored });
const retrieval = memory.query({
  source: MEMORY_SOURCES.ENSEMBLE,
  strategyKey: 'memory-aware-agent-ensemble',
  keywords: ['non-quorum', 'incomplete', 'partial-proof'],
  limit: 1
});

assert.equal(report.quorum, 2);
assert.equal(report.attemptedAgents, 2);
assert.equal(report.completedAgents, 1);
assert.equal(report.provenAgents, 1);
assert.equal(report.quorumMet, false);
assert.equal(report.allComplete, false);
assert.equal(report.allProven, false);
assert.equal(report.auditValid, false);
assert.equal(report.members[0].proven, true);
assert.equal(report.members[1].completed, false);
assert.equal(report.members[1].proven, false);
assert.equal(report.members[1].auditValid, false);
assert.notEqual(report.members[1].error, null);
assert.equal(record.payload.quorumMet, false);
assert.equal(record.payload.allComplete, false);
assert.equal(record.payload.allProven, false);
assert.equal(restoredEnsemble.quorumMet, false);
assert.equal(restoredEnsemble.allComplete, false);
assert.equal(restoredEnsemble.allProven, false);
assert.equal(restoredEnsemble.completedAgents, 1);
assert.equal(restoredEnsemble.provenAgents, 1);
assert.equal(restoredEnsemble.members[1].completed, false);
assert.equal(restoredEnsemble.members[1].proven, false);
assert.equal(restoredEnsemble.members[1].error !== null, true);
assert.equal(restoredEnsemble.dataOnly, true);
assert.equal(restoredEnsemble.authorityTransferred, false);
assert.equal(retrieval.results.length, 1);
assert.equal(retrieval.results[0].source, MEMORY_SOURCES.ENSEMBLE);
assert.equal(retrieval.results[0].evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(retrieval.results[0].historicalOnly, true);
assert.equal(retrieval.results[0].provenance.kind, 'memory-aware-ensemble');
assert.equal(Object.hasOwn(restoredEnsemble, 'agents'), false);
assert.equal(Object.hasOwn(restoredEnsemble, 'runReports'), false);
assert.equal(Object.hasOwn(retrieval.results[0], 'members'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ENSEMBLE_LEDGER_NON_QUORUM_OK kind=${record.kind} `
  + `agents=${restoredEnsemble.attemptedAgents} completed=${restoredEnsemble.completedAgents} `
  + `proven=${restoredEnsemble.provenAgents} quorum=${restoredEnsemble.quorum} `
  + `quorumMet=${restoredEnsemble.quorumMet} complete=${restoredEnsemble.allComplete} `
  + `memoryMatches=${retrieval.results.length} proof=${EVIDENCE_LEVELS.OBSERVED} `
  + `summaryOnly=true authoritySuppressed=true`
);
