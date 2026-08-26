import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import {
  isTrustedMemoryAwareAgentCoordinationReport
} from '../src/memory-agent-coordination.mjs';
import {
  isTrustedMemoryAwareAgentSessionReport,
  MemoryAwareAgentSessionRunner
} from '../src/memory-agent-session.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-session-ledger-planner',
  description: 'A deterministic process-isolated graph planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphCoordination',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-session-ledger-planner-runtime'
  })
});
const evaluationCase = new AgentPlannerCase({
  id: 'memory-aware-session-ledger-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-session-ledger-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-session-ledger-task',
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
      id: 'memory-aware-session-ledger-history',
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
  proposalRunner: new AgentArchitectureProposalRunner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'proposeArchitectureDirect',
      timeoutMs: 2000
    })
  }),
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
    taskId: 'memory-aware-session-ledger-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-session-ledger-proof'
});

assert.equal(isTrustedMemoryAwareAgentSessionReport(report), true);
assert.equal(isTrustedMemoryAwareAgentCoordinationReport(report.coordination), true);
const entry = verifiedLedger.appendMemoryAwareSession(report);
assert.equal(entry.kind, 'memory-aware-session');
assert.equal(entry.payload.dataOnly, true);
assert.equal(entry.payload.authorityTransferred, false);
assert.equal(entry.payload.deployed, false);
assert.equal(entry.payload.constitutionalMutation, false);
assert.equal(entry.payload.discoverySummary.adopted, true);
assert.equal(entry.payload.discoverySummary.architectureId, 'process-architecture-direct');
assert.equal(typeof entry.payload.architectureFingerprint, 'string');
assert.equal(
  entry.payload.discoverySummary.architectureFingerprint,
  entry.payload.architectureFingerprint
);
assert.equal(entry.payload.coordination.roundConsensus.length, 2);
assert.equal(entry.payload.coordination.roundConsensus[1].quorumMet, true);
assert.equal(entry.payload.transcriptFingerprint.startsWith('sha256:'), true);

const serialized = verifiedLedger.serialize();
const restoredLedger = EvidenceLedger.fromSerialized(serialized);
assert.equal(restoredLedger.verify(), true);
assert.deepEqual(restoredLedger.serialize(), serialized);
const restoredSessions = restoredLedger.restoreMemoryAwareSessions();
assert.equal(restoredSessions.length, 1);
const restored = restoredSessions[0];
assert.deepEqual(restored, entry.payload);
assert.equal(restored.dataOnly, true);
assert.equal(restored.authorityTransferred, false);
assert.equal(restored.finalQuorumMet, true);
assert.equal(restored.allRoundsProven, true);
assert.equal(restored.persistenceComplete, true);
assert.equal(restored.architectureFingerprint, entry.payload.architectureFingerprint);
assert.equal(restored.coordination.roundCount, 2);
assert.equal(restored.coordination.roundConsensus[0].provenAgents, 2);
assert.equal(restored.coordination.roundConsensus[1].quorumMet, true);
assert.equal(isTrustedMemoryAwareAgentSessionReport(restored), false);
assert.equal(isTrustedMemoryAwareAgentCoordinationReport(restored.coordination), false);
assert.equal(Object.hasOwn(restored, 'runner'), false);
assert.equal(Object.hasOwn(restored, 'discovery'), false);
assert.equal(Object.hasOwn(restored, 'adoption'), false);
assert.equal(Object.hasOwn(restored, 'ledger'), false);
assert.equal(Object.hasOwn(restored.coordination, 'agents'), false);
assert.equal(Object.hasOwn(restored.coordination.rounds[0].members[0], 'runReport'), false);
assert.equal(Object.hasOwn(restored.coordination.rounds[0].members[0], 'actionEvidence'), false);
assert.equal(Object.isFrozen(restored), true);
assert.equal(Object.isFrozen(restored.discoverySummary), true);
assert.equal(Object.isFrozen(restored.coordination), true);
assert.equal(Object.isFrozen(restored.coordination.rounds[0].members[0]), true);
assert.equal(Object.isFrozen(restored.coordination.roundConsensus[0]), true);

assert.deepEqual(new EvidenceLedger().restoreMemoryAwareSessions(), []);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_SESSION_LEDGER_OK kind=${entry.kind} sessions=${restoredSessions.length} `
  + `architecture=${restored.architectureId} rounds=${restored.coordination.roundCount} `
  + `consensus=${restored.finalQuorumMet} persisted=${restored.coordination.persistedRuns} `
  + `summaryOnly=${restored.dataOnly} trustedRestored=${isTrustedMemoryAwareAgentSessionReport(restored)}`
);
