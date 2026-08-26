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
  isTrustedMemoryAwareAgentRunReport,
  memoryAwareAgentFromArchitectureAdoption
} from '../src/memory-agent.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-architecture-planner-candidate',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-architecture-planner'
  })
});
const architectureCandidate = new AgentArchitectureCandidate({
  id: 'memory-aware-architecture-candidate',
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
  id: 'memory-aware-architecture-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-architecture-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-architecture-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles.length === 1
    && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
});

function evaluate(candidate) {
  return new AgentArchitectureSearchRunner().evaluate({
    candidates: [candidate],
    cases: [evaluationCase],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
}

const primary = evaluate(architectureCandidate);
const reproduction = evaluate(architectureCandidate);
const reproducibility = new AgentArchitectureReproducibilityAuthority().reproduce({
  searchReport: primary,
  reproductionReport: reproduction,
  candidateId: architectureCandidate.id
});
const adoptionDecision = new AgentArchitectureAdoptionAuthority().adopt(reproducibility);
assert.equal(adoptionDecision.adopted, true);

const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-architecture-history', description: 'Find a graph path' },
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
const agent = memoryAwareAgentFromArchitectureAdoption({
  adoption: adoptionDecision.adoption,
  ledger: verifiedLedger
});
const receipt = agent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: {
    taskId: 'memory-aware-architecture-next-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-agent-architecture-check'
});

assert.equal(isTrustedMemoryAwareAgentRunReport(receipt), true);
assert.equal(agent.planner.plannerId, 'memory-aware-architecture-planner');
assert.equal(agent.runner.policy.maxEpisodes, 2);
assert.equal(receipt.memoryContext.resultCount, 1);
assert.equal(receipt.run.priorWorldModelHistoryLength, 1);
assert.equal(receipt.run.completed, true);
assert.deepEqual(receipt.run.actionEvidence, ['PROVEN']);
assert.equal(receipt.authorityTransferred, false);
assert.equal(Object.hasOwn(receipt, 'adoption'), false);
assert.equal(Object.hasOwn(receipt, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ARCHITECTURE_OK adopted=${adoptionDecision.adopted} `
  + `plannerFresh=true policy=${agent.runner.policy.maxEpisodes} memoryResults=${receipt.memoryContext.resultCount} `
  + `worldModelHistory=${receipt.run.priorWorldModelHistoryLength} proof=${receipt.run.actionEvidence[0]} `
  + `authorityTransferred=${receipt.authorityTransferred}`
);
