import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import {
  AgentArchitectureAdoptionAuthority,
  AgentArchitectureCandidate,
  AgentArchitectureReproducibilityAuthority,
  AgentArchitectureSearchRunner,
  isTrustedAgentArchitectureAdoption
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
  id: 'memory-aware-architecture-boundary-planner-candidate',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-architecture-boundary-planner'
  })
});
const architectureCandidate = new AgentArchitectureCandidate({
  id: 'memory-aware-architecture-boundary-candidate',
  plannerCandidate,
  policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
  components: {
    planner: 'registered-process-planner',
    policy: 'bounded-v1',
    verifier: 'parent-core'
  }
});
const evaluationCase = new AgentPlannerCase({
  id: 'memory-aware-architecture-boundary-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-architecture-boundary-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-architecture-boundary-task',
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
assert.equal(isTrustedAgentArchitectureAdoption(adoptionDecision.adoption), true);
const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-architecture-boundary-history', description: 'Find a graph path' },
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
  () => memoryAwareAgentFromArchitectureAdoption({ adoption: {}, ledger: verifiedLedger }),
  /trusted adoption evidence/
);
assert.throws(
  () => memoryAwareAgentFromArchitectureAdoption({
    adoption: Object.create(Object.getPrototypeOf(adoptionDecision.adoption)),
    ledger: verifiedLedger
  }),
  /trusted adoption evidence/
);
assert.throws(
  () => memoryAwareAgentFromArchitectureAdoption({
    adoption: adoptionDecision.adoption,
    ledger: {}
  }),
  /trusted evidence ledger/
);
const accessorOptions = {
  adoption: adoptionDecision.adoption,
  ledger: verifiedLedger
};
Object.defineProperty(accessorOptions, 'idPrefix', {
  enumerable: true,
  get() {
    return 'forged-prefix';
  }
});
assert.throws(
  () => memoryAwareAgentFromArchitectureAdoption(accessorOptions),
  /only enumerable data properties/
);

const agent = memoryAwareAgentFromArchitectureAdoption({
  adoption: adoptionDecision.adoption,
  ledger: verifiedLedger
});
const receipt = agent.run({
  goal: 'graph',
  context: { taskId: 'memory-aware-architecture-boundary-run', description: 'Find a graph path' }
});
assert.equal(isTrustedMemoryAwareAgentRunReport(receipt), true);
assert.equal(receipt.run.actionEvidence[0], 'PROVEN');
assert.equal(receipt.authorityTransferred, false);
assert.equal(Object.hasOwn(receipt, 'adoption'), false);
assert.equal(Object.hasOwn(receipt, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ARCHITECTURE_BOUNDARY_OK forgedAdoptionRejected=true `
  + `plainAdoptionRejected=true forgedLedgerRejected=true accessorRejected=true `
  + `proofSuppressed=${Object.hasOwn(receipt, 'actionReport') === false} freshPlanner=true `
  + `trustedRun=${isTrustedMemoryAwareAgentRunReport(receipt)}`
);
