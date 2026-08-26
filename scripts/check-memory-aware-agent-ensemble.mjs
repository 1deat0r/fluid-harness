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
  isTrustedMemoryAwareAgentLedgerReceipt
} from '../src/memory-agent.mjs';
import {
  isTrustedMemoryAwareAgentEnsembleReport,
  MemoryAwareAgentEnsembleRunner,
  memoryAwareAgentEnsembleFromArchitectureAdoption
} from '../src/memory-agent-ensemble.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-ensemble-planner-candidate',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-ensemble-planner'
  })
});
const architectureCandidate = new AgentArchitectureCandidate({
  id: 'memory-aware-ensemble-architecture-candidate',
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
  id: 'memory-aware-ensemble-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-ensemble-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-ensemble-task',
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
    task: { id: 'memory-aware-ensemble-history', description: 'Find a graph path' },
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
const agents = memoryAwareAgentEnsembleFromArchitectureAdoption({
  adoption: adoption.adoption,
  ledger: verifiedLedger,
  agentCount: 2
});
const report = new MemoryAwareAgentEnsembleRunner({
  maxAgents: 2,
  minimumProvenAgents: 2
}).run({
  agents,
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: {
    taskId: 'memory-aware-ensemble-next-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-agent-ensemble-check'
});

assert.equal(isTrustedMemoryAwareAgentEnsembleReport(report), true);
assert.equal(Object.isFrozen(agents), true);
assert.equal(Object.isFrozen(report), true);
assert.equal(report.attemptedAgents, 2);
assert.equal(report.completedAgents, 2);
assert.equal(report.provenAgents, 2);
assert.equal(report.quorum, 2);
assert.equal(report.quorumMet, true);
assert.equal(report.allComplete, true);
assert.equal(report.allProven, true);
assert.equal(report.auditValid, true);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(Object.hasOwn(report, 'agents'), false);
assert.equal(Object.hasOwn(report, 'runReports'), false);
assert.equal(agents[0] !== agents[1], true);
assert.equal(agents[0].planner !== agents[1].planner, true);
assert.equal(agents[0].runner !== agents[1].runner, true);
assert.equal(agents[0].architectureId, architectureCandidate.id);
assert.equal(agents[1].architectureId, architectureCandidate.id);
assert.equal(report.members.length, 2);
for (const member of report.members) {
  assert.equal(member.completed, true);
  assert.equal(member.proven, true);
  assert.equal(member.auditValid, true);
  assert.equal(member.memoryResultCount, 1);
  assert.deepEqual(member.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
  assert.equal(member.dataOnly, true);
  assert.equal(member.authorityTransferred, false);
  assert.equal(Object.hasOwn(member, 'agent'), false);
  assert.equal(Object.hasOwn(member, 'runReport'), false);
}
assert.equal(report.members[0].plannerId, report.members[1].plannerId);
assert.equal(report.members[0].architectureId, architectureCandidate.id);
assert.equal(report.members[1].architectureId, architectureCandidate.id);

const firstLedgerReceipt = agents[0].persistRun({ ledger: verifiedLedger });
const secondLedgerReceipt = agents[1].persistRun({ ledger: verifiedLedger });
assert.equal(isTrustedMemoryAwareAgentLedgerReceipt(firstLedgerReceipt), true);
assert.equal(isTrustedMemoryAwareAgentLedgerReceipt(secondLedgerReceipt), true);
assert.equal(firstLedgerReceipt.architectureId, architectureCandidate.id);
assert.equal(secondLedgerReceipt.architectureId, architectureCandidate.id);
assert.equal(verifiedLedger.length, 3);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ENSEMBLE_OK agents=${report.attemptedAgents} `
  + `completed=${report.completedAgents} proven=${report.provenAgents} quorum=${report.quorum} `
  + `quorumMet=${report.quorumMet} memoryResults=${report.members[0].memoryResultCount} `
  + `independent=${agents[0].planner !== agents[1].planner && agents[0].runner !== agents[1].runner} `
  + `summaryOnly=${report.dataOnly} proof=${report.members[0].actionEvidence[0]} `
  + `authorityTransferred=${report.authorityTransferred}`
);
