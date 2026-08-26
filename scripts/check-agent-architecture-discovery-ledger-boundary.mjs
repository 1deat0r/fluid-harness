import assert from 'node:assert/strict';

import {
  isTrustedAgentArchitectureDiscoveryReport
} from '../src/agent-architecture-discovery.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildArchitectureDiscoveryReport } from './fixtures/architecture-discovery-ledger.mjs';

const report = buildArchitectureDiscoveryReport();
assert.equal(isTrustedAgentArchitectureDiscoveryReport(report), true);
const ledger = new EvidenceLedger();
ledger.appendArchitectureDiscovery(report);
const serialized = ledger.serialize();
const restored = EvidenceLedger.fromSerialized(serialized).restoreArchitectureDiscoveries()[0];
assert.equal(isTrustedAgentArchitectureDiscoveryReport(restored), false);
assert.equal(restored.dataOnly, true);
assert.equal(restored.authorityTransferred, false);
assert.equal('runner' in restored, false);
assert.equal('proposalRunner' in restored, false);
assert.equal('authority' in restored, false);
assert.equal('adoption' in restored, false);

assert.throws(
  () => ledger.appendArchitectureDiscovery(Object.freeze({ ...report })),
  /trusted discovery report/
);
const forgedReport = Object.create(Object.getPrototypeOf(report));
assert.equal(isTrustedAgentArchitectureDiscoveryReport(forgedReport), false);
assert.throws(
  () => ledger.appendArchitectureDiscovery(forgedReport),
  /trusted discovery report/
);

const tamperedProposal = JSON.parse(serialized);
tamperedProposal.records[0].payload.proposals[0].components.forged = true;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedProposal)),
  /candidate .* inconsistent|fingerprint verification failed|hash verification failed/
);

const tamperedCandidate = JSON.parse(serialized);
tamperedCandidate.records[0].payload.candidates[0].components.forged = true;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedCandidate)),
  /candidate .* inconsistent|fingerprint verification failed|hash verification failed/
);

const tamperedCase = JSON.parse(serialized);
tamperedCase.records[0].payload.primary.results[0]
  .planner.results[0].production.results[0].proven = false;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedCase)),
  /inconsistent|fingerprint verification failed|hash verification failed/
);

const tamperedReplay = JSON.parse(serialized);
tamperedReplay.records[0].payload.reproducibility.candidateId = 'forged-discovery';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedReplay)),
  /reproducibility identity is inconsistent|fingerprint verification failed|hash verification failed/
);

const tamperedFingerprint = JSON.parse(serialized);
tamperedFingerprint.records[0].payload.transcriptFingerprint = 'sha256:forged';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedFingerprint)),
  /fingerprint verification failed|hash verification failed/
);

const tamperedBoundary = JSON.parse(serialized);
tamperedBoundary.records[0].payload.authorityTransferred = true;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedBoundary)),
  /proof boundary is invalid|fingerprint verification failed|hash verification failed/
);

const tamperedArtifact = JSON.parse(serialized);
tamperedArtifact.records[0].payload.runner = {};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedArtifact)),
  /invalid shape|hash verification failed/
);

console.log(
  `FLUID_AGENT_ARCHITECTURE_DISCOVERY_LEDGER_BOUNDARY_OK `
  + `forgedReportRejected=true proposalTamperRejected=true candidateTamperRejected=true `
  + `caseTamperRejected=true replayTamperRejected=true fingerprintRejected=true `
  + `proofBoundaryRejected=true artifactRejected=true restoredAuthority=`
  + `${isTrustedAgentArchitectureDiscoveryReport(restored)} summaryOnly=${restored.dataOnly}`
);
