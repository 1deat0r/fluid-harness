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
  id: 'memory-aware-session-planner',
  description: 'A deterministic process-isolated graph planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphCoordination',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-session-planner-runtime'
  })
});
const evaluationCase = new AgentPlannerCase({
  id: 'memory-aware-session-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-session-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-session-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles.length === 1
    && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
});
const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-session-history', description: 'Find a graph path' },
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
    taskId: 'memory-aware-session-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-session-proof'
});

assert.equal(isTrustedMemoryAwareAgentSessionReport(report), true);
assert.equal(isTrustedMemoryAwareAgentCoordinationReport(report.coordination), true);
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.discoverySummary), true);
assert.equal(report.discoverySummary.complete, true);
assert.equal(report.discoverySummary.adopted, true);
assert.equal(report.discoverySummary.reproducible, true);
assert.equal(report.discoverySummary.architectureId, 'process-architecture-direct');
assert.equal(typeof report.architectureFingerprint, 'string');
assert.equal(report.discoverySummary.architectureFingerprint, report.architectureFingerprint);
assert.equal(report.discoverySummary.proposalCount, 1);
assert.equal(report.discoverySummary.candidateCount, 1);
assert.equal(report.adopted, true);
assert.equal(report.freshAgents, true);
assert.equal(report.finalQuorumMet, true);
assert.equal(report.allRoundsProven, true);
assert.equal(report.persistenceComplete, true);
assert.equal(report.ledgerLengthBefore, 1);
assert.equal(report.ledgerLengthAfter, 5);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(report.deployed, false);
assert.equal(report.constitutionalMutation, false);
assert.equal(Object.hasOwn(report, 'discovery'), false);
assert.equal(Object.hasOwn(report, 'adoption'), false);
assert.equal(Object.hasOwn(report, 'ledger'), false);
assert.equal(Object.hasOwn(report.discoverySummary, 'adoption'), false);
assert.equal(Object.hasOwn(report.discoverySummary, 'primary'), false);
assert.equal(Object.hasOwn(report.discoverySummary, 'reproducibility'), false);
assert.equal(report.coordination.rounds[0].members[0].memoryResultCount, 1);
assert.equal(report.coordination.rounds[1].members[0].memoryResultCount, 3);
assert.equal(report.coordination.rounds[1].context.coordination.peerEvidence.length, 2);
assert.equal(report.coordination.rounds[0].members[0].proven, true);
assert.equal(report.coordination.rounds[1].members[0].proven, true);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_SESSION_OK discovered=${report.discoverySummary.complete} `
  + `adopted=${report.adopted} architecture=${report.architectureId} rounds=${report.coordination.roundCount} `
  + `firstMemory=${report.coordination.rounds[0].members[0].memoryResultCount} `
  + `secondMemory=${report.coordination.rounds[1].members[0].memoryResultCount} `
  + `peerEvidence=${report.coordination.rounds[1].context.coordination.peerEvidence.length} `
  + `ledgerAfter=${report.ledgerLengthAfter} quorum=${report.finalQuorumMet} `
  + `summaryOnly=${report.dataOnly} authorityTransferred=${report.authorityTransferred}`
);
