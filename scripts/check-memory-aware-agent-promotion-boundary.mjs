import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import {
  AgentPlannerCandidate,
  AgentPlannerCase,
  AgentPlannerPromotionAuthority,
  AgentPlannerSearchRunner
} from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  isTrustedMemoryAwareAgentRunReport,
  memoryAwareAgentFromPlannerPromotion
} from '../src/memory-agent.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const candidate = new AgentPlannerCandidate({
  id: 'memory-aware-promotion-boundary-candidate',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphFromMemory',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-promotion-boundary-planner'
  })
});
const evaluationCase = new AgentPlannerCase({
  id: 'memory-aware-promotion-boundary-case',
  domain: 'graph',
  goal: 'graph',
  context: null,
  task: {
    id: 'memory-graph',
    description: 'Find a graph path with -1 historical matches'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
});
function evaluate() {
  return new AgentPlannerSearchRunner().evaluate({
    candidates: [candidate],
    cases: [evaluationCase],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
}
const primary = evaluate();
const reproduction = evaluate();
const authority = new AgentPlannerPromotionAuthority();
const decision = authority.promote(authority.reproduce({
  searchReport: primary,
  reproductionReport: reproduction,
  candidateId: candidate.id
}));
const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-promotion-boundary-history', description: 'Find a graph path' },
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
  () => memoryAwareAgentFromPlannerPromotion({
    promotion: {},
    ledger: verifiedLedger
  }),
  /trusted promotion evidence/
);
assert.throws(
  () => memoryAwareAgentFromPlannerPromotion({
    promotion: Object.create(Object.getPrototypeOf(decision.promotion)),
    ledger: verifiedLedger
  }),
  /trusted promotion evidence/
);
assert.throws(
  () => memoryAwareAgentFromPlannerPromotion({
    promotion: decision.promotion,
    ledger: {}
  }),
  /trusted evidence ledger/
);
const accessorOptions = {
  promotion: decision.promotion,
  ledger: verifiedLedger
};
Object.defineProperty(accessorOptions, 'idPrefix', {
  enumerable: true,
  get() {
    return 'forged-prefix';
  }
});
assert.throws(
  () => memoryAwareAgentFromPlannerPromotion(accessorOptions),
  /only enumerable data properties/
);

const agent = memoryAwareAgentFromPlannerPromotion({
  promotion: decision.promotion,
  ledger: verifiedLedger
});
const receipt = agent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: { taskId: 'memory-aware-promotion-boundary-run' }
});
assert.equal(isTrustedMemoryAwareAgentRunReport(receipt), true);
assert.equal(receipt.run.actionEvidence[0], 'PROVEN');
assert.equal(receipt.authorityTransferred, false);
assert.equal(Object.hasOwn(receipt, 'promotion'), false);
assert.equal(Object.hasOwn(receipt, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_PROMOTION_BOUNDARY_OK forgedPromotionRejected=true `
  + `plainPromotionRejected=true forgedLedgerRejected=true accessorRejected=true `
  + `proofSuppressed=${Object.hasOwn(receipt, 'actionReport') === false} freshPlanner=true `
  + `trustedRun=${isTrustedMemoryAwareAgentRunReport(receipt)}`
);
