import assert from 'node:assert/strict';

import {
  isTrustedAgentArchitectureDiscoveryReport
} from '../src/agent-architecture-discovery.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildArchitectureDiscoveryReport } from './fixtures/architecture-discovery-ledger.mjs';

const report = buildArchitectureDiscoveryReport({
  expected: () => false,
  caseId: 'architecture-discovery-ledger-rejection-case',
  plannerId: 'architecture-discovery-ledger-rejection-planner',
  goal: 'retain a bounded rejected architecture discovery'
});
assert.equal(isTrustedAgentArchitectureDiscoveryReport(report), true);
assert.equal(report.complete, true);
assert.equal(report.reproducibility.reproducible, true);
assert.equal(report.adopted, false);
assert.equal(report.adoption.reasons.length > 0, true);

const ledger = new EvidenceLedger();
const entry = ledger.appendArchitectureDiscovery(report);
assert.equal(entry.payload.complete, true);
assert.equal(entry.payload.reproducibility.reproducible, true);
assert.equal(entry.payload.adopted, false);
assert.equal(entry.payload.adoptedArchitectureFingerprint, null);
assert.equal(entry.payload.adoptionReasons.length > 0, true);
assert.equal(entry.payload.primary.results[0].fitness.productionSuccessRate, 0);
assert.equal(entry.payload.primary.results[0].planner.results[0].production.results[0].expected, false);

const restored = EvidenceLedger.fromSerialized(ledger.serialize())
  .restoreArchitectureDiscoveries()[0];
assert.equal(restored.complete, true);
assert.equal(restored.reproducibility.reproducible, true);
assert.equal(restored.adopted, false);
assert.equal(restored.adoptedArchitectureFingerprint, null);
assert.equal(restored.adoptionReasons.length > 0, true);
assert.equal(restored.primary.results[0].fitness.productionSuccessRate, 0);
assert.equal(restored.dataOnly, true);
assert.equal(restored.authorityTransferred, false);
assert.equal('adoption' in restored, false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_DISCOVERY_LEDGER_REJECTION_OK complete=${restored.complete} `
  + `replay=${restored.reproducibility.reproducible} adopted=${restored.adopted} `
  + `reasons=${restored.adoptionReasons.length} proof=NOT_PROVEN dataOnly=${restored.dataOnly} `
  + `authorityTransferred=${restored.authorityTransferred}`
);
