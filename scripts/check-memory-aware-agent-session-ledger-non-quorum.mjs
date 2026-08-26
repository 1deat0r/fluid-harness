import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { MemoryAwareAgentSessionRunner } from '../src/memory-agent-session.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-session-ledger-non-quorum-planner',
  description: 'A deterministic planner with one controlled member failure',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphCoordinationWithOneFailure',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-session-ledger-non-quorum-planner-runtime'
  })
});
const taskId = 'memory-aware-session-ledger-non-quorum-task';
const ledger = new EvidenceLedger();
const session = new MemoryAwareAgentSessionRunner({
  proposalRunner: new AgentArchitectureProposalRunner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'proposeArchitectureDirect',
      timeoutMs: 2000
    })
  }),
  agentCount: 3,
  maxRounds: 2,
  minimumProvenAgents: 3
});
const report = session.run({
  architectureGoal: 'discover a non-quorum graph architecture',
  agentGoal: 'graph',
  plannerCandidates: [plannerCandidate],
  cases: [new AgentPlannerCase({
    id: 'memory-aware-session-ledger-non-quorum-case',
    domain: 'graph',
    goal: 'graph',
    context: { taskId, description: 'Find a graph path' },
    task: { id: taskId, description: 'Find a graph path' },
    adversarial: true,
    expected: (candidateReport) => candidateReport?.completed === true
  })],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 }),
  ledger,
  query: { keywords: ['graph-algorithms'], limit: 3 },
  context: { taskId, description: 'Find a graph path' },
  reproduction: 'memory-aware-session-ledger-non-quorum-proof'
});

assert.equal(report.finalQuorumMet, false);
assert.equal(report.allRoundsProven, false);
assert.equal(report.persistenceComplete, false);
assert.equal(report.coordination.roundConsensus[0].failedAgents, 1);
assert.equal(report.coordination.roundConsensus[1].quorumMet, false);
assert.equal(report.coordination.persistedRuns, 4);
assert.equal(report.coordination.expectedPersistedRuns, 6);

const entry = ledger.appendMemoryAwareSession(report);
assert.equal(entry.payload.finalQuorumMet, false);
assert.equal(entry.payload.allRoundsProven, false);
assert.equal(entry.payload.persistenceComplete, false);
assert.equal(entry.payload.coordination.roundConsensus[1].failedAgents, 1);
const restored = EvidenceLedger.fromSerialized(ledger.serialize())
  .restoreMemoryAwareSessions()[0];
assert.equal(restored.finalQuorumMet, false);
assert.equal(restored.allRoundsProven, false);
assert.equal(restored.persistenceComplete, false);
assert.equal(restored.coordination.roundConsensus[0].failedAgents, 1);
assert.equal(restored.coordination.roundConsensus[1].quorumMet, false);
assert.equal(restored.coordination.persistedRuns, 4);
assert.equal(restored.coordination.expectedPersistedRuns, 6);
assert.equal(restored.dataOnly, true);
assert.equal(restored.authorityTransferred, false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_SESSION_LEDGER_NON_QUORUM_OK finalQuorum=${restored.finalQuorumMet} `
  + `allRoundsProven=${restored.allRoundsProven} failedAgents=${restored.coordination.roundConsensus[0].failedAgents} `
  + `persisted=${restored.coordination.persistedRuns}/${restored.coordination.expectedPersistedRuns} `
  + `proof=NOT_PROVEN dataOnly=${restored.dataOnly} authorityTransferred=${restored.authorityTransferred}`
);
