import assert from 'node:assert/strict';

import {
  isTrustedMemoryAwareAgentEnsembleReport
} from '../src/memory-agent-ensemble.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildMemoryAwareAdversarialEnsemble } from './fixtures/memory-aware-adversarial-ensemble.mjs';

const { ledger, report } = buildMemoryAwareAdversarialEnsemble({
  prefix: 'memory-aware-agent-ensemble-ledger'
});
const record = ledger.appendMemoryAwareAgentEnsemble(report);
const serialized = ledger.serialize();
const restored = EvidenceLedger.fromSerialized(serialized);
const ensembles = restored.restoreMemoryAwareAgentEnsembles();
const restoredEnsemble = ensembles[0];

assert.equal(isTrustedMemoryAwareAgentEnsembleReport(report), true);
assert.equal(ledger.verify(), true);
assert.equal(record.kind, 'memory-aware-ensemble');
assert.equal(record.payload.attemptedAgents, 2);
assert.equal(record.payload.completedAgents, 2);
assert.equal(record.payload.provenAgents, 2);
assert.equal(record.payload.quorum, 2);
assert.equal(record.payload.quorumMet, true);
assert.equal(record.payload.dataOnly, true);
assert.equal(record.payload.authorityTransferred, false);
assert.equal(Object.isFrozen(record), true);
assert.equal(Object.isFrozen(record.payload), true);
assert.equal(Object.isFrozen(record.payload.members), true);
assert.equal(Object.isFrozen(record.payload.members[0].actionEvidence), true);
assert.equal(Object.hasOwn(record.payload, 'agents'), false);
assert.equal(Object.hasOwn(record.payload, 'runReports'), false);
assert.equal(Object.hasOwn(record.payload, 'actionReport'), false);
assert.equal(restored.verify(), true);
assert.equal(restored.serialize(), serialized);
assert.equal(ensembles.length, 1);
assert.equal(isTrustedMemoryAwareAgentEnsembleReport(restoredEnsemble), false);
assert.equal(Object.isFrozen(ensembles), true);
assert.equal(Object.isFrozen(restoredEnsemble), true);
assert.equal(Object.isFrozen(restoredEnsemble.members), true);
assert.equal(Object.isFrozen(restoredEnsemble.members[0]), true);
assert.equal(Object.isFrozen(restoredEnsemble.members[0].actionEvidence), true);
assert.equal(restoredEnsemble.goal, report.goal);
assert.equal(restoredEnsemble.query.source, report.query.source);
assert.equal(restoredEnsemble.attemptedAgents, report.attemptedAgents);
assert.equal(restoredEnsemble.completedAgents, report.completedAgents);
assert.equal(restoredEnsemble.provenAgents, report.provenAgents);
assert.equal(restoredEnsemble.allComplete, true);
assert.equal(restoredEnsemble.allProven, true);
assert.equal(restoredEnsemble.quorumMet, true);
assert.equal(restoredEnsemble.dataOnly, true);
assert.equal(restoredEnsemble.authorityTransferred, false);
assert.deepEqual(
  restoredEnsemble.members[0].actionEvidence,
  [ 'PROVEN' ]
);
assert.equal(Object.hasOwn(restoredEnsemble, 'agents'), false);
assert.equal(Object.hasOwn(restoredEnsemble, 'runReports'), false);
assert.equal(Object.hasOwn(restoredEnsemble, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ENSEMBLE_LEDGER_OK kind=${record.kind} `
  + `ensembles=${ensembles.length} agents=${restoredEnsemble.attemptedAgents} `
  + `completed=${restoredEnsemble.completedAgents} proven=${restoredEnsemble.provenAgents} `
  + `quorum=${restoredEnsemble.quorum} restoredTrusted=false frozen=true `
  + `dataOnly=${restoredEnsemble.dataOnly} authoritySuppressed=true`
);
