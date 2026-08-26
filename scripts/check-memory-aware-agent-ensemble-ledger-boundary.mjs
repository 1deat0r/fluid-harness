import assert from 'node:assert/strict';

import {
  isTrustedMemoryAwareAgentEnsembleReport,
  MemoryAwareAgentEnsembleRunner
} from '../src/memory-agent-ensemble.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildMemoryAwareAdversarialEnsemble } from './fixtures/memory-aware-adversarial-ensemble.mjs';

const { ledger, report } = buildMemoryAwareAdversarialEnsemble({
  prefix: 'memory-aware-agent-ensemble-ledger-boundary'
});
ledger.appendMemoryAwareAgentEnsemble(report);
assert.equal(isTrustedMemoryAwareAgentEnsembleReport(report), true);
assert.throws(
  () => ledger.appendMemoryAwareAgentEnsemble({}),
  /trusted ensemble report/
);
assert.throws(
  () => ledger.appendMemoryAwareAgentEnsemble(
    Object.create(Object.getPrototypeOf(report))
  ),
  /trusted ensemble report/
);
assert.throws(
  () => new MemoryAwareAgentEnsembleRunner({ maxAgents: 5 }),
  /cannot exceed 4/
);

const serialized = ledger.serialize();
const tamperedMetrics = JSON.parse(serialized);
tamperedMetrics.records[1] = {
  ...tamperedMetrics.records[1],
  payload: {
    ...tamperedMetrics.records[1].payload,
    provenAgents: 0
  }
};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedMetrics)),
  /inconsistent|hash verification failed/
);
const nestedTamper = JSON.parse(serialized);
nestedTamper.records[1] = {
  ...nestedTamper.records[1],
  payload: {
    ...nestedTamper.records[1].payload,
    members: nestedTamper.records[1].payload.members.map((member, index) => (
      index === 0
        ? { ...member, actionEvidence: [] }
        : member
    ))
  }
};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(nestedTamper)),
  /inconsistent|hash verification failed|action evidence/
);
const proofTamper = JSON.parse(serialized);
proofTamper.records[1] = {
  ...proofTamper.records[1],
  payload: {
    ...proofTamper.records[1].payload,
    authorityTransferred: true
  }
};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(proofTamper)),
  /proof boundary|hash verification failed|inconsistent/
);
const artifactTamper = JSON.parse(serialized);
artifactTamper.records[1] = {
  ...artifactTamper.records[1],
  payload: {
    ...artifactTamper.records[1].payload,
    agents: []
  }
};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(artifactTamper)),
  /invalid shape|hash verification failed/
);
const duplicateIndexTamper = JSON.parse(serialized);
duplicateIndexTamper.records[1] = {
  ...duplicateIndexTamper.records[1],
  payload: {
    ...duplicateIndexTamper.records[1].payload,
    members: duplicateIndexTamper.records[1].payload.members.map((member, index) => (
      index === 1
        ? { ...member, index: 0 }
        : member
    ))
  }
};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(duplicateIndexTamper)),
  /index is invalid|hash verification failed/
);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ENSEMBLE_LEDGER_BOUNDARY_OK `
  + `forgedReportRejected=true forgedConstructorRejected=true maxRejected=true `
  + `tamperedMetricsRejected=true nestedTamperRejected=true proofBoundaryRejected=true `
  + `artifactRejected=true duplicateIndexRejected=true authoritySuppressed=true`
);
