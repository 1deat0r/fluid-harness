import assert from 'node:assert/strict';

import {
  isTrustedAgentArchitectureDiscoveryReport
} from '../src/agent-architecture-discovery.mjs';
import {
  EvidenceLedger,
  isTrustedEvidenceLedger
} from '../src/evidence-ledger.mjs';
import { buildArchitectureDiscoveryReport } from './fixtures/architecture-discovery-ledger.mjs';

const report = buildArchitectureDiscoveryReport();
assert.equal(isTrustedAgentArchitectureDiscoveryReport(report), true);
assert.equal(report.complete, true);
assert.equal(report.adopted, true);

const ledger = new EvidenceLedger();
const entry = ledger.appendArchitectureDiscovery(report);
assert.equal(isTrustedEvidenceLedger(ledger), true);
assert.equal(entry.kind, 'architecture-discovery');
assert.equal(entry.payload.dataOnly, true);
assert.equal(entry.payload.authorityTransferred, false);
assert.equal(entry.payload.complete, true);
assert.equal(entry.payload.adopted, true);
assert.equal(entry.payload.proposals.length, 3);
assert.equal(entry.payload.candidates.length, 3);
assert.equal(entry.payload.primary.results.length, 3);
assert.equal(entry.payload.reproduction.results.length, 3);
assert.equal(entry.payload.reproducibility.reproducible, true);
assert.equal(entry.payload.transcriptFingerprint.startsWith('sha256:'), true);
assert.equal(ledger.verify(), true);

const serialized = ledger.serialize();
const restoredLedger = EvidenceLedger.fromSerialized(serialized);
assert.equal(restoredLedger.verify(), true);
assert.deepEqual(restoredLedger.serialize(), serialized);
const discoveries = restoredLedger.restoreArchitectureDiscoveries();
assert.equal(discoveries.length, 1);
const restored = discoveries[0];
assert.equal(restored.winnerId, entry.payload.winnerId);
assert.equal(restored.winnerArchitectureFingerprint, entry.payload.winnerArchitectureFingerprint);
assert.equal(restored.adoptedArchitectureFingerprint, entry.payload.adoptedArchitectureFingerprint);
assert.equal(restored.primary.results[0].planner.results[0].production.results[0].proven, true);
assert.equal(Object.isFrozen(restored), true);
assert.equal(Object.isFrozen(restored.candidates[0]), true);
assert.equal(Object.isFrozen(restored.primary.results[0].planner.results[0].production), true);
assert.equal(isTrustedAgentArchitectureDiscoveryReport(restored), false);
assert.equal('runner' in restored, false);
assert.equal('proposalRunner' in restored, false);
assert.equal('authority' in restored, false);
assert.equal('plannerFactory' in restored.candidates[0], false);
assert.equal('planner' in restored.candidates[0], false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_DISCOVERY_LEDGER_OK kind=${entry.kind} `
  + `discoveries=${discoveries.length} proposals=${restored.proposals.length} `
  + `candidates=${restored.candidates.length} replay=${restored.reproducibility.reproducible} `
  + `adopted=${restored.adopted} dataOnly=${restored.dataOnly} `
  + `trustedRestored=${isTrustedAgentArchitectureDiscoveryReport(restored)}`
);
