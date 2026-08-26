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
  isTrustedMemoryAwareAgentLedgerReceipt,
  isTrustedMemoryAwareAgentRunReport,
  memoryAwareAgentFromArchitectureAdoption
} from '../src/memory-agent.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-architecture-lineage-planner-candidate',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-architecture-lineage-planner'
  })
});
const architectureCandidate = new AgentArchitectureCandidate({
  id: 'memory-aware-architecture-lineage-candidate',
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
  id: 'memory-aware-architecture-lineage-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-architecture-lineage-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-architecture-lineage-task',
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
    task: { id: 'memory-aware-architecture-lineage-history', description: 'Find a graph path' },
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

const firstAgent = memoryAwareAgentFromArchitectureAdoption({
  adoption: adoptionDecision.adoption,
  ledger: verifiedLedger
});
const firstReceipt = firstAgent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: {
    taskId: 'memory-aware-architecture-lineage-first-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-agent-architecture-lineage-first'
});
const firstLedgerReceipt = firstAgent.persistRun({ ledger: verifiedLedger });

const nextLedger = EvidenceLedger.fromSerialized(verifiedLedger.serialize());
const secondAgent = memoryAwareAgentFromArchitectureAdoption({
  adoption: adoptionDecision.adoption,
  ledger: nextLedger
});
const secondReceipt = secondAgent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 2 },
  context: {
    taskId: 'memory-aware-architecture-lineage-second-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-agent-architecture-lineage-second'
});
const secondLedgerReceipt = secondAgent.persistRun({ ledger: nextLedger });

assert.equal(isTrustedMemoryAwareAgentRunReport(firstReceipt), true);
assert.equal(isTrustedMemoryAwareAgentRunReport(secondReceipt), true);
assert.equal(isTrustedMemoryAwareAgentLedgerReceipt(firstLedgerReceipt), true);
assert.equal(isTrustedMemoryAwareAgentLedgerReceipt(secondLedgerReceipt), true);
assert.equal(firstAgent.architectureId, architectureCandidate.id);
assert.equal(secondAgent.architectureId, architectureCandidate.id);
assert.equal(firstReceipt.architectureId, architectureCandidate.id);
assert.equal(secondReceipt.architectureId, architectureCandidate.id);
assert.equal(firstReceipt.previousArchitectureId, null);
assert.equal(secondReceipt.previousArchitectureId, architectureCandidate.id);
assert.equal(firstReceipt.plan.architectureId, architectureCandidate.id);
assert.equal(secondReceipt.plan.architectureId, architectureCandidate.id);
assert.equal(firstReceipt.plan.previousArchitectureId, null);
assert.equal(secondReceipt.plan.previousArchitectureId, architectureCandidate.id);
assert.equal(firstLedgerReceipt.architectureId, architectureCandidate.id);
assert.equal(secondLedgerReceipt.architectureId, architectureCandidate.id);
assert.equal(verifiedLedger.restoreAgentRuns()[1].architectureId, architectureCandidate.id);
assert.equal(nextLedger.restoreAgentRuns()[2].architectureId, architectureCandidate.id);
assert.notEqual(firstAgent.planner, secondAgent.planner);
assert.notEqual(firstAgent.runner, secondAgent.runner);
assert.equal(firstReceipt.memoryContext.resultCount, 1);
assert.equal(secondReceipt.memoryContext.resultCount, 2);
assert.equal(secondReceipt.run.priorWorldModelHistoryLength, 2);
assert.deepEqual(firstReceipt.run.actionEvidence, ['PROVEN']);
assert.deepEqual(secondReceipt.run.actionEvidence, ['PROVEN']);
assert.equal(firstLedgerReceipt.sequence, 2);
assert.equal(secondLedgerReceipt.sequence, 3);
assert.equal(secondLedgerReceipt.ledgerLength, 3);
assert.equal(firstReceipt.authorityTransferred, false);
assert.equal(secondReceipt.authorityTransferred, false);
assert.equal(Object.hasOwn(firstReceipt, 'adoption'), false);
assert.equal(Object.hasOwn(secondReceipt, 'adoption'), false);
assert.equal(Object.hasOwn(firstReceipt, 'actionReport'), false);
assert.equal(Object.hasOwn(secondReceipt, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ARCHITECTURE_LINEAGE_OK generations=2 `
  + `architecture=${secondReceipt.architectureId} firstMemory=${firstReceipt.memoryContext.resultCount} `
  + `secondMemory=${secondReceipt.memoryContext.resultCount} `
  + `secondHistory=${secondReceipt.run.priorWorldModelHistoryLength} `
  + `predecessor=${secondReceipt.previousArchitectureId} plannersFresh=true runnersFresh=true `
  + `proof=${secondReceipt.run.actionEvidence[0]} persistedSequence=${secondLedgerReceipt.sequence} `
  + `authorityTransferred=${secondReceipt.authorityTransferred}`
);
