import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import {
  AgentArchitectureDiscoveryRunner
} from '../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  isTrustedMemoryAwareAgentRunReport,
  memoryAwareAgentFromArchitectureDiscovery
} from '../src/memory-agent.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-discovery-boundary-planner-candidate',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-discovery-boundary-planner'
  })
});
const discovery = new AgentArchitectureDiscoveryRunner({
  proposalRunner: new AgentArchitectureProposalRunner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'proposeArchitectureDirect',
      timeoutMs: 2000
    })
  })
}).discover({
  goal: 'discover a bounded graph architecture for boundary testing',
  plannerCandidates: [plannerCandidate],
  cases: [new AgentPlannerCase({
    id: 'memory-aware-discovery-boundary-case',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'memory-aware-discovery-boundary-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'memory-aware-discovery-boundary-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (report) => report?.completed === true
      && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
  })],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(discovery.complete, true);
assert.equal(discovery.adopted, true);

const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-discovery-boundary-history', description: 'Find a graph path' },
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
  () => memoryAwareAgentFromArchitectureDiscovery({ discovery: {}, ledger: verifiedLedger }),
  /trusted discovery report/
);
assert.throws(
  () => memoryAwareAgentFromArchitectureDiscovery({
    discovery: Object.create(Object.getPrototypeOf(discovery)),
    ledger: verifiedLedger
  }),
  /trusted discovery report/
);
assert.throws(
  () => memoryAwareAgentFromArchitectureDiscovery({ discovery, ledger: {} }),
  /trusted evidence ledger/
);
const accessorOptions = { discovery, ledger: verifiedLedger };
Object.defineProperty(accessorOptions, 'idPrefix', {
  enumerable: true,
  get() {
    return 'forged-prefix';
  }
});
assert.throws(
  () => memoryAwareAgentFromArchitectureDiscovery(accessorOptions),
  /only enumerable data properties/
);

const agent = memoryAwareAgentFromArchitectureDiscovery({
  discovery,
  ledger: verifiedLedger
});
const receipt = agent.run({
  goal: 'graph',
  context: {
    taskId: 'memory-aware-discovery-boundary-run',
    description: 'Find a graph path'
  }
});
assert.equal(isTrustedMemoryAwareAgentRunReport(receipt), true);
assert.equal(receipt.architectureId, discovery.adoptedCandidate.id);
assert.equal(receipt.run.actionEvidence[0], 'PROVEN');
assert.equal(receipt.authorityTransferred, false);
assert.equal(Object.hasOwn(receipt, 'discovery'), false);
assert.equal(Object.hasOwn(receipt, 'adoption'), false);
assert.equal(Object.hasOwn(receipt, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ARCHITECTURE_DISCOVERY_BOUNDARY_OK forgedDiscoveryRejected=true `
  + `plainDiscoveryRejected=true forgedLedgerRejected=true accessorRejected=true `
  + `discoverySuppressed=true proofSuppressed=${Object.hasOwn(receipt, 'actionReport') === false} `
  + `trustedRun=${isTrustedMemoryAwareAgentRunReport(receipt)}`
);
