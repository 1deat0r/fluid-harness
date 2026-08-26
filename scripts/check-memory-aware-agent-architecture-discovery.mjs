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
  id: 'memory-aware-discovery-planner-candidate',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-discovery-planner'
  })
});
const discoveryRunner = new AgentArchitectureDiscoveryRunner({
  proposalRunner: new AgentArchitectureProposalRunner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'proposeArchitectureDirect',
      timeoutMs: 2000
    })
  })
});
const discovery = discoveryRunner.discover({
  goal: 'discover a bounded graph architecture for memory-aware execution',
  plannerCandidates: [plannerCandidate],
  cases: [new AgentPlannerCase({
    id: 'memory-aware-discovery-case',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'memory-aware-discovery-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'memory-aware-discovery-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (report) => report?.completed === true
      && report.cycles.length === 1
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
    task: { id: 'memory-aware-discovery-history', description: 'Find a graph path' },
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
const agent = memoryAwareAgentFromArchitectureDiscovery({
  discovery,
  ledger: verifiedLedger
});
const receipt = agent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: {
    taskId: 'memory-aware-discovery-next-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-agent-architecture-discovery'
});

assert.equal(isTrustedMemoryAwareAgentRunReport(receipt), true);
assert.equal(receipt.architectureId, discovery.adoptedCandidate.id);
assert.equal(receipt.previousArchitectureId, null);
assert.equal(receipt.memoryContext.resultCount, 1);
assert.equal(receipt.run.priorWorldModelHistoryLength, 1);
assert.deepEqual(receipt.run.actionEvidence, ['PROVEN']);
assert.equal(receipt.authorityTransferred, false);
assert.equal(Object.hasOwn(receipt, 'discovery'), false);
assert.equal(Object.hasOwn(receipt, 'adoption'), false);
assert.equal(Object.hasOwn(receipt, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ARCHITECTURE_DISCOVERY_OK complete=${discovery.complete} `
  + `adopted=${discovery.adopted} architecture=${receipt.architectureId} memoryResults=${receipt.memoryContext.resultCount} `
  + `worldModelHistory=${receipt.run.priorWorldModelHistoryLength} proof=${receipt.run.actionEvidence[0]} `
  + `authorityTransferred=${receipt.authorityTransferred}`
);
