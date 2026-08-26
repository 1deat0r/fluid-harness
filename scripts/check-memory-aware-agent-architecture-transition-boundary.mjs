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
import { memoryFromLedger } from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function buildAdoption(label) {
  const plannerCandidate = new AgentPlannerCandidate({
    id: `memory-aware-transition-boundary-${label}-planner-candidate`,
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphDirect',
        timeoutMs: 2000
      }),
      plannerId: `memory-aware-transition-boundary-${label}-planner`
    })
  });
  const architectureCandidate = new AgentArchitectureCandidate({
    id: `memory-aware-transition-boundary-architecture-${label}`,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: {
      planner: `registered-process-planner-${label}`,
      policy: 'bounded-v1',
      verifier: 'parent-core'
    }
  });
  const evaluationCase = new AgentPlannerCase({
    id: `memory-aware-transition-boundary-${label}-case`,
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'memory-aware-architecture-transition-boundary-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'memory-aware-architecture-transition-boundary-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (report) => report?.completed === true
      && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
  });
  const evaluate = () => new AgentArchitectureSearchRunner().evaluate({
    candidates: [architectureCandidate],
    cases: [evaluationCase],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
  const adoption = new AgentArchitectureAdoptionAuthority().adopt(
    new AgentArchitectureReproducibilityAuthority().reproduce({
      searchReport: evaluate(),
      reproductionReport: evaluate(),
      candidateId: architectureCandidate.id
    })
  );
  assert.equal(adoption.adopted, true);
  return { adoption: adoption.adoption, architectureCandidate };
}

const first = buildAdoption('a');
const second = buildAdoption('b');
const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-architecture-transition-boundary-history', description: 'Find a graph path' },
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

assert.throws(
  () => memoryAwareAgentFromArchitectureAdoption({
    adoption: Object.create(Object.getPrototypeOf(second.adoption)),
    ledger: verifiedLedger
  }),
  /trusted adoption evidence/
);
assert.throws(
  () => memoryAwareAgentFromArchitectureAdoption({
    adoption: second.adoption,
    ledger: {}
  }),
  /trusted evidence ledger/
);

const firstAgent = memoryAwareAgentFromArchitectureAdoption({
  adoption: first.adoption,
  ledger: verifiedLedger
});
const firstReceipt = firstAgent.run({
  goal: 'graph',
  context: {
    taskId: 'memory-aware-architecture-transition-boundary-first',
    description: 'Find a graph path'
  }
});
firstAgent.persistRun({ ledger: verifiedLedger });
const architectureMemory = memoryFromLedger({ ledger: verifiedLedger });
const architectureResults = architectureMemory.query({
  architectureId: first.architectureCandidate.id,
  keywords: ['graph-algorithms'],
  limit: 1
});
assert.equal(architectureResults.returnedCount, 1);
assert.equal(architectureResults.results[0].architectureId, first.architectureCandidate.id);
const accessorQuery = { architectureId: first.architectureCandidate.id };
Object.defineProperty(accessorQuery, 'architectureId', {
  enumerable: true,
  get() {
    return first.architectureCandidate.id;
  }
});
assert.throws(
  () => architectureMemory.query(accessorQuery),
  /only enumerable data properties/
);
const serialized = verifiedLedger.serialize();
const tampered = serialized.replace(first.architectureCandidate.id, 'forged-transition-architecture');
assert.notEqual(tampered, serialized);
assert.throws(
  () => EvidenceLedger.fromSerialized(tampered),
  /hash verification failed/
);

const nextLedger = EvidenceLedger.fromSerialized(serialized);
const secondAgent = memoryAwareAgentFromArchitectureAdoption({
  adoption: second.adoption,
  ledger: nextLedger
});
const secondReceipt = secondAgent.run({
  goal: 'graph',
  context: {
    taskId: 'memory-aware-architecture-transition-boundary-second',
    description: 'Find a graph path'
  }
});
assert.equal(isTrustedMemoryAwareAgentRunReport(firstReceipt), true);
assert.equal(isTrustedMemoryAwareAgentRunReport(secondReceipt), true);
assert.equal(firstReceipt.previousArchitectureId, null);
assert.equal(secondReceipt.previousArchitectureId, first.architectureCandidate.id);
assert.equal(secondReceipt.architectureId, second.architectureCandidate.id);
assert.equal(secondReceipt.run.actionEvidence[0], 'PROVEN');
assert.equal(secondReceipt.authorityTransferred, false);
assert.equal(Object.hasOwn(secondReceipt, 'adoption'), false);
assert.equal(Object.hasOwn(secondReceipt, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ARCHITECTURE_TRANSITION_BOUNDARY_OK forgedAdoptionRejected=true `
  + `forgedLedgerRejected=true tamperedLedgerRejected=true predecessorDerived=true `
  + `attributionFilter=true accessorRejected=true freshArchitecture=true `
  + `proof=${secondReceipt.run.actionEvidence[0]} `
  + `authorityTransferred=${secondReceipt.authorityTransferred}`
);
