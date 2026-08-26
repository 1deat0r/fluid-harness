import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import {
  isTrustedMemoryAwareAgentSessionReport,
  MemoryAwareAgentSessionRunner
} from '../src/memory-agent-session.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  EvidenceLedger,
  isTrustedEvidenceLedger
} from '../src/evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const proposalRunner = new AgentArchitectureProposalRunner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'proposeArchitectureDirect',
    timeoutMs: 2000
  })
});
const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-session-ledger-boundary-planner',
  description: 'A deterministic process-isolated graph planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphCoordination',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-session-ledger-boundary-planner-runtime'
  })
});
const evaluationCase = new AgentPlannerCase({
  id: 'memory-aware-session-ledger-boundary-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-session-ledger-boundary-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-session-ledger-boundary-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles.length === 1
    && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
});
const ledger = new EvidenceLedger();
ledger.appendAgentRun(new BoundedAgentRunner().run({
  episodes: [{
    task: {
      id: 'memory-aware-session-ledger-boundary-history',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }]
}));
const verifiedLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const session = new MemoryAwareAgentSessionRunner({
  proposalRunner,
  agentCount: 2,
  maxRounds: 2,
  minimumProvenAgents: 2
});
const report = session.run({
  architectureGoal: 'discover a bounded graph architecture',
  agentGoal: 'graph',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 }),
  ledger: verifiedLedger,
  query: { keywords: ['graph-algorithms'], limit: 3 },
  context: {
    taskId: 'memory-aware-session-ledger-boundary-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-session-ledger-boundary-proof'
});
assert.equal(isTrustedMemoryAwareAgentSessionReport(report), true);
assert.equal(isTrustedEvidenceLedger(verifiedLedger), true);
const entry = verifiedLedger.appendMemoryAwareSession(report);
const serialized = verifiedLedger.serialize();
const restored = EvidenceLedger.fromSerialized(serialized).restoreMemoryAwareSessions()[0];
assert.equal(restored.dataOnly, true);
assert.equal(restored.authorityTransferred, false);
assert.equal(isTrustedMemoryAwareAgentSessionReport(restored), false);

assert.throws(
  () => verifiedLedger.appendMemoryAwareSession(Object.freeze({ ...report })),
  /trusted session report/
);
const forgedReport = Object.create(Object.getPrototypeOf(report));
assert.equal(isTrustedMemoryAwareAgentSessionReport(forgedReport), false);
assert.throws(
  () => verifiedLedger.appendMemoryAwareSession(forgedReport),
  /trusted session report/
);
assert.throws(
  () => verifiedLedger.appendMemoryAwareSession(report.coordination),
  /trusted session report/
);
assert.throws(
  () => new EvidenceLedger().appendMemoryAwareSession(report),
  /match the current ledger length/
);

const tamperedFingerprint = JSON.parse(serialized);
tamperedFingerprint.records[tamperedFingerprint.records.length - 1]
  .payload.transcriptFingerprint = 'sha256:forged';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedFingerprint)),
  /fingerprint verification failed|hash verification failed/
);
const tamperedCoordination = JSON.parse(serialized);
tamperedCoordination.records[tamperedCoordination.records.length - 1]
  .payload.coordination.roundConsensus[0].provenAgents = 0;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedCoordination)),
  /consensus .* inconsistent|fingerprint verification failed|hash verification failed/
);
const tamperedBoundary = JSON.parse(serialized);
tamperedBoundary.records[tamperedBoundary.records.length - 1].payload.dataOnly = false;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedBoundary)),
  /proof boundary is invalid|fingerprint verification failed|hash verification failed/
);
const tamperedDiscovery = JSON.parse(serialized);
tamperedDiscovery.records[tamperedDiscovery.records.length - 1]
  .payload.discoverySummary.candidateCount = 0;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedDiscovery)),
  /candidateCount is invalid|fingerprint verification failed|hash verification failed/
);
const tamperedConsistency = JSON.parse(serialized);
tamperedConsistency.records[tamperedConsistency.records.length - 1]
  .payload.architectureId = 'forged-session-architecture';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedConsistency)),
  /summary is inconsistent|fingerprint verification failed|hash verification failed/
);
const tamperedArchitectureFingerprint = JSON.parse(serialized);
tamperedArchitectureFingerprint.records[tamperedArchitectureFingerprint.records.length - 1]
  .payload.architectureFingerprint = 'forged-architecture-definition';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedArchitectureFingerprint)),
  /summary is inconsistent|fingerprint verification failed|hash verification failed/
);
const tamperedArtifact = JSON.parse(serialized);
tamperedArtifact.records[tamperedArtifact.records.length - 1].payload.runner = {};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedArtifact)),
  /invalid shape|hash verification failed/
);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_SESSION_LEDGER_BOUNDARY_OK forgedReportRejected=true `
  + `coordinationRejected=true fingerprintRejected=true nestedTamperRejected=true `
  + `proofBoundaryRejected=true discoveryRejected=true consistencyRejected=true `
  + `artifactRejected=true ledgerAlignmentRejected=true architectureFingerprintRejected=true `
  + `restoredAuthority=${isTrustedMemoryAwareAgentSessionReport(restored)} `
  + `summaryOnly=${restored.dataOnly} entry=${entry.kind}`
);
