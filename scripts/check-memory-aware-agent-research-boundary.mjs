import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  BoundedAgentRunner
} from '../src/agent.mjs';
import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  MemoryAwareAgentResearchReceipt,
  isTrustedMemoryAwareAgentResearchReceipt,
  memoryAwareAgentFromLedger
} from '../src/memory-agent.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { RepresentationCandidate } from '../src/search.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function researchSpec(prefix, caseCount = 1, maxCases = caseCount) {
  const cases = [];
  for (let index = 0; index < caseCount; index += 1) {
    cases.push(new EvaluationCase({
      id: `${prefix}-case-${index + 1}`,
      domain: 'graph',
      adversarial: true,
      task: { id: `${prefix}-task-${index + 1}`, description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.path.join('>') === 'A>B'
    }));
  }
  return {
    candidates: [new RepresentationCandidate({
      id: `${prefix}-candidate`,
      selectorFactory: () => new HeuristicRepresentationSelector()
    })],
    cases,
    productionBudget: new EvaluationBudget({ maxCases }),
    researchBudget: new EvaluationBudget({ maxCases }),
    skepticBudget: new EvaluationBudget({ maxCases })
  };
}

const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-research-boundary-history', description: 'Find a graph path' },
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
const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());

function makeAgent(plannerId) {
  return memoryAwareAgentFromLedger({
    ledger: restoredLedger,
    planner: new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphFromMemoryNoPath',
        timeoutMs: 2000
      }),
      plannerId
    })
  });
}

const beforeRun = makeAgent('memory-aware-research-before-run');
assert.throws(
  () => beforeRun.resolveResearch({ research: researchSpec('memory-aware-before-run') }),
  /requires a prior bounded run/
);

const incompleteAgent = makeAgent('memory-aware-research-incomplete');
incompleteAgent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: { taskId: 'memory-aware-incomplete-task' }
});
const incomplete = incompleteAgent.resolveResearch({
  research: researchSpec('memory-aware-incomplete-search', 2, 1)
});
assert.equal(incomplete.status, 'INCOMPLETE');
assert.equal(incomplete.search.complete, false);
assert.equal(incomplete.pendingResearchCount, 1);
const retried = incompleteAgent.resolveResearch({
  research: researchSpec('memory-aware-incomplete-retry')
});
assert.equal(retried.status, 'RESOLVED');
assert.equal(retried.pendingResearchCount, 0);

const errorAgent = makeAgent('memory-aware-research-error');
errorAgent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: { taskId: 'memory-aware-error-task' }
});
const failed = errorAgent.resolveResearch({ research: {} });
assert.equal(failed.status, 'ERROR');
assert.match(failed.error, /requires candidates/);
assert.equal(failed.pendingResearchCount, 1);
const accessorOptions = { research: researchSpec('memory-aware-accessor') };
Object.defineProperty(accessorOptions, 'taskId', {
  enumerable: true,
  get() {
    return 'memory-aware-error-task';
  }
});
assert.throws(
  () => errorAgent.resolveResearch(accessorOptions),
  /only enumerable data properties/
);
const recovered = errorAgent.resolveResearch({
  taskId: 'memory-aware-error-task',
  research: researchSpec('memory-aware-error-retry')
});
assert.equal(recovered.status, 'RESOLVED');
assert.equal(recovered.pendingResearchCount, 0);

assert.throws(
  () => new MemoryAwareAgentResearchReceipt({ resolution: {} }),
  /trusted research resolution/
);
assert.equal(isTrustedMemoryAwareAgentResearchReceipt(recovered), true);
assert.equal(Object.hasOwn(recovered, 'searchReport'), false);
assert.equal(Object.hasOwn(recovered, 'actionReport'), false);
assert.equal(recovered.authorityTransferred, false);
assert.equal(Object.isFrozen(recovered), true);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_RESEARCH_BOUNDARY_OK priorRunRejected=true `
  + `incompleteRetry=${retried.status === 'RESOLVED'} errorPreserved=${failed.status === 'ERROR'} `
  + `accessorRejected=true forgedReceiptRejected=true proofSuppressed=${Object.hasOwn(recovered, 'actionReport') === false} `
  + `immutable=${Object.isFrozen(recovered)}`
);
