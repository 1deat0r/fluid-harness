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
  MemoryAwareAgent,
  isTrustedMemoryAwareAgentRunReport,
  memoryAwareAgentFromArchitectureAdoption,
  memoryAwareAgentFromLedger
} from '../src/memory-agent.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { memoryFromLedger } from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function planner(plannerId) {
  return new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId
  });
}

const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-architecture-lineage-boundary-planner-candidate',
  plannerFactory: () => planner('memory-aware-architecture-lineage-boundary-planner')
});
const architectureCandidate = new AgentArchitectureCandidate({
  id: 'memory-aware-architecture-lineage-boundary-candidate',
  plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: {
    planner: 'registered-process-planner',
    policy: 'bounded-v1',
    verifier: 'parent-core'
  }
});
const evaluationCase = new AgentPlannerCase({
  id: 'memory-aware-architecture-lineage-boundary-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-architecture-lineage-boundary-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-architecture-lineage-boundary-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
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
    task: { id: 'memory-aware-architecture-lineage-boundary-history', description: 'Find a graph path' },
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
const forgedMemory = memoryFromLedger({ ledger: verifiedLedger });

assert.throws(
  () => new MemoryAwareAgent({
    memory: forgedMemory,
    planner: planner('memory-aware-architecture-lineage-forged-direct'),
    runner: new BoundedAgentRunner(),
    architectureId: 'forged-architecture-id'
  }),
  /architecture lineage requires the ledger factory/
);
assert.throws(
  () => new MemoryAwareAgent({
    memory: forgedMemory,
    planner: planner('memory-aware-architecture-lineage-forged-predecessor-direct'),
    runner: new BoundedAgentRunner(),
    previousArchitectureId: 'forged-previous-architecture-id'
  }),
  /predecessor lineage requires the ledger factory/
);
assert.throws(
  () => memoryAwareAgentFromLedger({
    ledger: verifiedLedger,
    planner: planner('memory-aware-architecture-lineage-forged-ledger'),
    runner: new BoundedAgentRunner(),
    architectureId: 'forged-architecture-id'
  }),
  /only enumerable data properties/
);
assert.throws(
  () => memoryAwareAgentFromLedger({
    ledger: verifiedLedger,
    planner: planner('memory-aware-architecture-lineage-forged-predecessor-ledger'),
    runner: new BoundedAgentRunner(),
    previousArchitectureId: 'forged-previous-architecture-id'
  }),
  /only enumerable data properties/
);

const agent = memoryAwareAgentFromArchitectureAdoption({
  adoption: adoptionDecision.adoption,
  ledger: verifiedLedger
});
const receipt = agent.run({
  goal: 'graph',
  context: {
    taskId: 'memory-aware-architecture-lineage-boundary-run',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-agent-architecture-lineage-boundary'
});
assert.equal(isTrustedMemoryAwareAgentRunReport(receipt), true);
assert.equal(receipt.architectureId, architectureCandidate.id);
assert.equal(receipt.previousArchitectureId, null);
assert.equal(receipt.plan.architectureId, architectureCandidate.id);
assert.equal(receipt.plan.previousArchitectureId, null);
assert.throws(() => {
  receipt.architectureId = 'forged-architecture-id';
});
assert.equal(Object.hasOwn(receipt, 'adoption'), false);
assert.equal(Object.hasOwn(receipt, 'actionReport'), false);
assert.equal(receipt.run.actionEvidence[0], 'PROVEN');
assert.equal(receipt.authorityTransferred, false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ARCHITECTURE_LINEAGE_BOUNDARY_OK directLineageRejected=true `
  + `directPredecessorRejected=true ledgerLineageRejected=true ledgerPredecessorRejected=true `
  + `immutableRejected=true adoptionSuppressed=true fresh=true `
  + `proof=${receipt.run.actionEvidence[0]}`
);
