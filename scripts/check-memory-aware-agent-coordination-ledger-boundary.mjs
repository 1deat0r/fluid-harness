import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import {
  isTrustedMemoryAwareAgentCoordinationReport
} from '../src/memory-agent-coordination.mjs';
import { MemoryAwareAgentSessionRunner } from '../src/memory-agent-session.mjs';
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
  id: 'memory-aware-coordination-ledger-boundary-planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphCoordination',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-coordination-ledger-boundary-planner'
  })
});
const evaluationCase = new AgentPlannerCase({
  id: 'memory-aware-coordination-ledger-boundary-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-coordination-ledger-boundary-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-coordination-ledger-boundary-task',
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
      id: 'memory-aware-coordination-ledger-boundary-history',
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
    taskId: 'memory-aware-coordination-ledger-boundary-task',
    description: 'Find a graph path'
  }
});
const coordination = report.coordination;
assert.equal(isTrustedMemoryAwareAgentCoordinationReport(coordination), true);
assert.equal(isTrustedEvidenceLedger(verifiedLedger), true);
const entry = verifiedLedger.appendMemoryAwareCoordination(coordination);
assert.equal(entry.kind, 'memory-aware-coordination');
assert.equal(entry.payload.dataOnly, true);
assert.equal(entry.payload.authorityTransferred, false);
assert.equal(entry.payload.transcriptFingerprint.startsWith('sha256:'), true);
const serialized = verifiedLedger.serialize();
const restored = EvidenceLedger.fromSerialized(serialized);
const transcripts = restored.restoreMemoryAwareCoordination();
assert.equal(transcripts.length, 1);
assert.equal(transcripts[0].dataOnly, true);
assert.equal(transcripts[0].authorityTransferred, false);
assert.equal(transcripts[0].roundCount, 2);
assert.equal(transcripts[0].roundConsensus.length, 2);
assert.equal(transcripts[0].persistedRuns, 4);
assert.equal(transcripts[0].roundConsensus[0].provenAgents, 2);
assert.equal(transcripts[0].roundConsensus[0].quorumMet, true);
assert.equal(isTrustedMemoryAwareAgentCoordinationReport(transcripts[0]), false);
assert.equal(Object.hasOwn(transcripts[0], 'agents'), false);
assert.equal(Object.hasOwn(transcripts[0], 'adoption'), false);
assert.equal(Object.hasOwn(transcripts[0], 'ledger'), false);
assert.equal(Object.hasOwn(transcripts[0].rounds[0].members[0], 'runReport'), false);
assert.equal(Object.hasOwn(transcripts[0].rounds[0].members[0], 'actionEvidence'), false);
assert.equal(Object.isFrozen(transcripts[0]), true);
assert.equal(Object.isFrozen(transcripts[0].rounds[0].members[0]), true);

assert.throws(
  () => verifiedLedger.appendMemoryAwareCoordination(Object.freeze({ ...coordination })),
  /trusted coordination report/
);
const forgedReport = Object.create(Object.getPrototypeOf(coordination));
assert.equal(isTrustedMemoryAwareAgentCoordinationReport(forgedReport), false);
assert.throws(
  () => verifiedLedger.appendMemoryAwareCoordination(forgedReport),
  /trusted coordination report/
);
assert.throws(
  () => new EvidenceLedger().appendMemoryAwareCoordination(coordination),
  /match the current ledger length/
);
const tamperedPeer = JSON.parse(serialized);
const tamperedPeerRecord = tamperedPeer.records[tamperedPeer.records.length - 1];
tamperedPeerRecord.payload.peerMessages[0][0].proven = false;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedPeer)),
  /peer .* does not match|fingerprint verification failed|hash verification failed/
);
const tamperedFingerprint = JSON.parse(serialized);
tamperedFingerprint.records[tamperedFingerprint.records.length - 1].payload.transcriptFingerprint = 'sha256:forged';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedFingerprint)),
  /fingerprint verification failed|hash verification failed/
);
const tamperedBoundary = JSON.parse(serialized);
tamperedBoundary.records[tamperedBoundary.records.length - 1].payload.authorityTransferred = true;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedBoundary)),
  /proof boundary is invalid|hash verification failed|fingerprint verification failed/
);
const tamperedConsensus = JSON.parse(serialized);
tamperedConsensus.records[tamperedConsensus.records.length - 1]
  .payload.roundConsensus[0].provenAgents = 0;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedConsensus)),
  /consensus .* inconsistent|fingerprint verification failed|hash verification failed/
);
const tamperedArtifact = JSON.parse(serialized);
tamperedArtifact.records[tamperedArtifact.records.length - 1].payload.agents = [];
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedArtifact)),
  /invalid shape|hash verification failed/
);
const tamperedIdentifier = JSON.parse(serialized);
tamperedIdentifier.records[tamperedIdentifier.records.length - 1]
  .payload.rounds[0].members[0].architectureId = '';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedIdentifier)),
  /architectureId must be a non-empty string|fingerprint verification failed|hash verification failed/
);
const emptyLedger = new EvidenceLedger();
assert.deepEqual(emptyLedger.restoreMemoryAwareCoordination(), []);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_COORDINATION_LEDGER_BOUNDARY_OK forgedReportRejected=true `
  + `restoredAuthority=false tamperPeerRejected=true fingerprintRejected=true `
  + `proofBoundaryRejected=true consensusRejected=true artifactRejected=true identifierRejected=true `
  + `ledgerAlignmentRejected=true trustedRestored=${isTrustedMemoryAwareAgentCoordinationReport(transcripts[0])}`
);
