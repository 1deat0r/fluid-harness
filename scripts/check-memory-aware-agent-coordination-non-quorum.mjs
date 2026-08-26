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
  id: 'memory-aware-coordination-non-quorum-planner-candidate',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphCoordinationWithOneFailure',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-coordination-non-quorum-planner'
  })
});
const architectureCandidate = new AgentArchitectureCandidate({
  id: 'memory-aware-coordination-non-quorum-architecture-candidate',
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
  id: 'memory-aware-coordination-non-quorum-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-coordination-non-quorum-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-coordination-non-quorum-task',
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
    task: { id: 'memory-aware-coordination-non-quorum-history', description: 'Find a graph path' },
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
  agentCount: 3,
  maxRounds: 2,
  minimumProvenAgents: 3
}).run({
  adoption: adoption.adoption,
  ledger: verifiedLedger,
  agentGoal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 3 },
  context: {
    taskId: 'memory-aware-coordination-non-quorum-next-task',
    description: 'Find a graph path',
    memoryAwareEnsemble: {
      memberIndex: 1
    }
  },
  reproduction: 'memory-aware-agent-coordination-non-quorum-check'
});

assert.equal(isTrustedMemoryAwareAgentCoordinationReport(report), true);
assert.equal(Object.isFrozen(report), true);
assert.equal(report.roundCount, 2);
assert.equal(report.roundConsensus.length, 2);
assert.equal(report.allRoundsQuorumMet, false);
assert.equal(report.finalQuorumMet, false);
assert.equal(report.allRoundsComplete, false);
assert.equal(report.allRoundsProven, false);
assert.equal(report.persistedRuns, 4);
assert.equal(report.expectedPersistedRuns, 6);
assert.equal(report.persistenceComplete, false);
assert.equal(report.ledgerLengthBefore, 1);
assert.equal(report.ledgerLengthAfter, 5);
assert.equal(report.messagesDataOnly, true);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(report.peerMessages[0].length, 3);
assert.equal(report.peerMessages[1].length, 3);
assert.equal(report.rounds[0].provenAgents, 2);
assert.equal(report.rounds[0].quorum, 3);
assert.equal(report.rounds[0].quorumMet, false);
assert.equal(report.rounds[1].provenAgents, 2);
assert.equal(report.rounds[1].quorumMet, false);
for (const round of report.rounds) {
  assert.equal(round.completedAgents, 2);
  assert.equal(round.provenAgents, 2);
  assert.equal(round.allComplete, false);
  assert.equal(round.allProven, false);
  assert.equal(round.quorumMet, false);
  assert.equal(round.members[1].completed, false);
  assert.equal(round.members[1].proven, false);
  assert.equal(typeof round.members[1].error, 'string');
  assert.equal(round.members[1].actionEvidence.length, 0);
  assert.equal(round.members[0].error, null);
  assert.equal(round.members[2].error, null);
}
for (const consensus of report.roundConsensus) {
  assert.equal(consensus.attemptedAgents, 3);
  assert.equal(consensus.completedAgents, 2);
  assert.equal(consensus.provenAgents, 2);
  assert.equal(consensus.auditValidAgents, 2);
  assert.equal(consensus.failedAgents, 1);
  assert.equal(consensus.quorum, 3);
  assert.equal(consensus.quorumMet, false);
  assert.equal(consensus.allComplete, false);
  assert.equal(consensus.allProven, false);
  assert.equal(consensus.dataOnly, true);
  assert.equal(consensus.authorityTransferred, false);
}
assert.equal(report.rounds[0].context.coordination.peerConsensus, null);
assert.deepEqual(report.rounds[1].context.coordination.peerConsensus, report.roundConsensus[0]);
for (const round of report.persistence) {
  assert.equal(round.filter((entry) => entry.persisted).length, 2);
  assert.equal(round.filter((entry) => !entry.persisted).length, 1);
}

const transcriptEntry = verifiedLedger.appendMemoryAwareCoordination(report);
assert.equal(transcriptEntry.payload.allRoundsQuorumMet, false);
assert.equal(transcriptEntry.payload.finalQuorumMet, false);
assert.equal(transcriptEntry.payload.allRoundsProven, false);
assert.equal(transcriptEntry.payload.roundConsensus[1].quorumMet, false);
assert.equal(verifiedLedger.verify(), true);
const restoredLedger = EvidenceLedger.fromSerialized(verifiedLedger.serialize());
const restoredTranscripts = restoredLedger.restoreMemoryAwareCoordination();
assert.equal(restoredTranscripts.length, 1);
assert.equal(restoredTranscripts[0].allRoundsQuorumMet, false);
assert.equal(restoredTranscripts[0].finalQuorumMet, false);
assert.equal(restoredTranscripts[0].allRoundsProven, false);
assert.equal(restoredTranscripts[0].roundConsensus[0].failedAgents, 1);
assert.equal(restoredTranscripts[0].roundConsensus[1].quorumMet, false);
assert.equal(restoredTranscripts[0].persistedRuns, 4);
assert.equal(isTrustedMemoryAwareAgentCoordinationReport(restoredTranscripts[0]), false);
assert.equal(Object.hasOwn(restoredTranscripts[0], 'agents'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_COORDINATION_NON_QUORUM_OK rounds=${report.roundCount} `
  + `proven=${report.rounds[0].provenAgents} quorum=${report.rounds[0].quorum} `
  + `finalQuorum=${report.finalQuorumMet} allQuorums=${report.allRoundsQuorumMet} `
  + `persisted=${report.persistedRuns} expected=${report.expectedPersistedRuns} `
  + `ledgerAfter=${report.ledgerLengthAfter} failureCaptured=${report.rounds[0].members[1].error !== null} `
  + `proof=${report.allRoundsProven ? 'PROVEN' : 'NOT_PROVEN'} authorityTransferred=${report.authorityTransferred}`
);
