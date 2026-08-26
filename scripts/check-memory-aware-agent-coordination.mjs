import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import {
  AgentArchitectureAdoptionAuthority,
  AgentArchitectureCandidate,
  AgentArchitectureReproducibilityAuthority,
  AgentArchitectureSearchRunner
} from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  isTrustedMemoryAwareAgentCoordinationReport,
  MemoryAwareAgentCoordinationRunner
} from '../src/memory-agent-coordination.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-coordination-planner-candidate',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphCoordination',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-coordination-planner'
  })
});
const architectureCandidate = new AgentArchitectureCandidate({
  id: 'memory-aware-coordination-architecture-candidate',
  plannerCandidate,
  policyFactory: () => new AgentPolicy({
    maxEpisodes: 2,
    maxToolCallsPerEpisode: 2
  }),
  components: {
    planner: 'registered-process-planner',
    policy: 'bounded-v1',
    verifier: 'parent-core'
  }
});
const evaluationCase = new AgentPlannerCase({
  id: 'memory-aware-coordination-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-coordination-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-coordination-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles.length === 1
    && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
});

function evaluate() {
  return new AgentArchitectureSearchRunner().evaluate({
    candidates: [architectureCandidate],
    cases: [evaluationCase],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
}

const adoption = new AgentArchitectureAdoptionAuthority().adopt(
  new AgentArchitectureReproducibilityAuthority().reproduce({
    searchReport: evaluate(),
    reproductionReport: evaluate(),
    candidateId: architectureCandidate.id
  })
);
assert.equal(adoption.adopted, true);

const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-coordination-history', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }]
});
const ledger = new EvidenceLedger();
ledger.appendAgentRun(sourceReport);
const verifiedLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const report = new MemoryAwareAgentCoordinationRunner({
  agentCount: 2,
  maxRounds: 2,
  minimumProvenAgents: 2
}).run({
  adoption: adoption.adoption,
  ledger: verifiedLedger,
  agentGoal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 3 },
  context: {
    taskId: 'memory-aware-coordination-next-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-agent-coordination-check'
});

assert.equal(isTrustedMemoryAwareAgentCoordinationReport(report), true);
assert.equal(Object.isFrozen(report), true);
assert.equal(report.roundCount, 2);
assert.equal(report.rounds.length, 2);
assert.equal(report.roundConsensus.length, 2);
assert.equal(report.allRoundsQuorumMet, true);
assert.equal(report.allRoundsComplete, true);
assert.equal(report.allRoundsProven, true);
assert.equal(report.finalQuorumMet, true);
assert.equal(report.persistedRuns, 4);
assert.equal(report.expectedPersistedRuns, 4);
assert.equal(report.persistenceComplete, true);
assert.equal(report.ledgerLengthBefore, 1);
assert.equal(report.ledgerLengthAfter, 5);
assert.equal(report.messagesDataOnly, true);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(Object.hasOwn(report, 'agents'), false);
assert.equal(Object.hasOwn(report, 'adoption'), false);
assert.equal(Object.hasOwn(report, 'ledger'), false);
assert.equal(Object.isFrozen(report.peerMessages[0]), true);
assert.equal(Object.isFrozen(report.peerMessages[1]), true);
assert.equal(report.peerMessages[0].length, 2);
assert.equal(report.peerMessages[1].length, 2);
assert.equal(report.peerMessages[1][0].proven, true);
assert.equal(Object.hasOwn(report.peerMessages[1][0], 'runReport'), false);
assert.equal(report.rounds[0].context.coordination.round, 1);
assert.equal(report.rounds[0].context.coordination.peerEvidence.length, 0);
assert.equal(report.rounds[0].context.coordination.peerConsensus, null);
assert.equal(report.rounds[1].context.coordination.round, 2);
assert.equal(report.rounds[1].context.coordination.peerEvidence.length, 2);
assert.deepEqual(report.rounds[1].context.coordination.peerConsensus, report.roundConsensus[0]);
for (const consensus of report.roundConsensus) {
  assert.equal(Object.isFrozen(consensus), true);
  assert.equal(consensus.dataOnly, true);
  assert.equal(consensus.authorityTransferred, false);
  assert.equal(consensus.attemptedAgents, 2);
  assert.equal(consensus.completedAgents, 2);
  assert.equal(consensus.provenAgents, 2);
  assert.equal(consensus.auditValidAgents, 2);
  assert.equal(consensus.failedAgents, 0);
  assert.equal(consensus.quorum, 2);
  assert.equal(consensus.quorumMet, true);
  assert.equal(consensus.allComplete, true);
  assert.equal(consensus.allProven, true);
}
assert.equal(report.rounds[0].members[0].memoryResultCount, 1);
assert.equal(report.rounds[1].members[0].memoryResultCount, 3);
for (const round of report.rounds) {
  assert.equal(Object.hasOwn(round, 'agents'), false);
  assert.equal(Object.hasOwn(round, 'runReports'), false);
  assert.equal(round.dataOnly, true);
  assert.equal(round.authorityTransferred, false);
  for (const member of round.members) {
    assert.equal(member.proven, true);
    assert.equal(member.dataOnly, true);
    assert.equal(member.authorityTransferred, false);
    assert.equal(Object.hasOwn(member, 'agent'), false);
    assert.equal(Object.hasOwn(member, 'runReport'), false);
  }
}
for (const round of report.persistence) {
  for (const entry of round) {
    assert.equal(entry.persisted, true);
    assert.equal(entry.architectureId, architectureCandidate.id);
    assert.equal(Object.hasOwn(entry, 'receipt'), false);
  }
}

const transcriptEntry = verifiedLedger.appendMemoryAwareCoordination(report);
assert.equal(transcriptEntry.kind, 'memory-aware-coordination');
assert.equal(transcriptEntry.payload.dataOnly, true);
assert.equal(transcriptEntry.payload.authorityTransferred, false);
assert.equal(transcriptEntry.payload.messagesDataOnly, true);
assert.equal(transcriptEntry.payload.transcriptFingerprint.startsWith('sha256:'), true);
assert.equal(verifiedLedger.verify(), true);
const serialized = verifiedLedger.serialize();
const restoredLedger = EvidenceLedger.fromSerialized(serialized);
assert.equal(restoredLedger.verify(), true);
assert.deepEqual(restoredLedger.serialize(), serialized);
const restoredTranscripts = restoredLedger.restoreMemoryAwareCoordination();
assert.equal(restoredTranscripts.length, 1);
assert.equal(restoredTranscripts[0].dataOnly, true);
assert.equal(restoredTranscripts[0].authorityTransferred, false);
assert.equal(restoredTranscripts[0].roundCount, 2);
assert.equal(restoredTranscripts[0].roundConsensus.length, 2);
assert.equal(restoredTranscripts[0].persistedRuns, 4);
assert.equal(restoredTranscripts[0].finalQuorumMet, true);
assert.equal(restoredTranscripts[0].roundConsensus[1].provenAgents, 2);
assert.equal(restoredTranscripts[0].roundConsensus[1].quorumMet, true);
assert.equal(restoredTranscripts[0].peerMessages[1].length, 2);
assert.equal(Object.isFrozen(restoredTranscripts[0]), true);
assert.equal(Object.isFrozen(restoredTranscripts[0].rounds[0].members[0]), true);
assert.equal(isTrustedMemoryAwareAgentCoordinationReport(restoredTranscripts[0]), false);
assert.equal(Object.hasOwn(restoredTranscripts[0], 'agents'), false);
assert.equal(Object.hasOwn(restoredTranscripts[0].rounds[0].members[0], 'runReport'), false);
assert.equal(Object.hasOwn(restoredTranscripts[0].rounds[0].members[0], 'actionEvidence'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_COORDINATION_OK rounds=${report.roundCount} agents=2 `
  + `firstMemory=${report.rounds[0].members[0].memoryResultCount} `
  + `secondMemory=${report.rounds[1].members[0].memoryResultCount} `
  + `peerEvidence=${report.rounds[1].context.coordination.peerEvidence.length} `
  + `persisted=${report.persistedRuns} ledgerBefore=${report.ledgerLengthBefore} `
  + `ledgerAfter=${report.ledgerLengthAfter} allQuorums=${report.allRoundsQuorumMet} `
  + `consensus=${report.roundConsensus[1].provenAgents}/${report.roundConsensus[1].quorum} `
  + `summaryOnly=${report.dataOnly} archived=${restoredTranscripts.length} `
  + `proof=${report.rounds[0].members[0].actionEvidence[0]} `
  + `authorityTransferred=${report.authorityTransferred}`
);
