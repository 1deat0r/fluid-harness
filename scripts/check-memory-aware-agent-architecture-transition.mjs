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
import { memoryFromLedger } from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function buildAdoption(label, maxEpisodes) {
  const plannerCandidate = new AgentPlannerCandidate({
    id: `memory-aware-transition-${label}-planner-candidate`,
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphDirect',
        timeoutMs: 2000
      }),
      plannerId: `memory-aware-transition-${label}-planner`
    })
  });
  const architectureCandidate = new AgentArchitectureCandidate({
    id: `memory-aware-transition-architecture-${label}`,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes,
      maxToolCallsPerEpisode: 2
    }),
    components: {
      planner: `registered-process-planner-${label}`,
      policy: 'bounded-v1',
      verifier: 'parent-core'
    }
  });
  const evaluationCase = new AgentPlannerCase({
    id: `memory-aware-transition-${label}-case`,
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'memory-aware-architecture-transition-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'memory-aware-architecture-transition-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (report) => report?.completed === true
      && report.cycles.length === 1
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

const first = buildAdoption('a', 2);
const second = buildAdoption('b', 3);
const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-architecture-transition-history', description: 'Find a graph path' },
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
  adoption: first.adoption,
  ledger: verifiedLedger
});
const firstReceipt = firstAgent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: {
    taskId: 'memory-aware-architecture-transition-first-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-agent-architecture-transition-first'
});
const firstLedgerReceipt = firstAgent.persistRun({ ledger: verifiedLedger });

const nextLedger = EvidenceLedger.fromSerialized(verifiedLedger.serialize());
const secondAgent = memoryAwareAgentFromArchitectureAdoption({
  adoption: second.adoption,
  ledger: nextLedger
});
const secondReceipt = secondAgent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 2 },
  context: {
    taskId: 'memory-aware-architecture-transition-second-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-agent-architecture-transition-second'
});
const secondLedgerReceipt = secondAgent.persistRun({ ledger: nextLedger });
const architectureMemory = memoryFromLedger({ ledger: nextLedger });
const firstArchitectureResults = architectureMemory.query({
  architectureId: first.architectureCandidate.id,
  keywords: ['graph-algorithms'],
  limit: 2
});
const secondArchitectureResults = architectureMemory.query({
  architectureId: second.architectureCandidate.id,
  keywords: ['graph-algorithms'],
  limit: 2
});

assert.equal(isTrustedMemoryAwareAgentRunReport(firstReceipt), true);
assert.equal(isTrustedMemoryAwareAgentRunReport(secondReceipt), true);
assert.equal(isTrustedMemoryAwareAgentLedgerReceipt(firstLedgerReceipt), true);
assert.equal(isTrustedMemoryAwareAgentLedgerReceipt(secondLedgerReceipt), true);
assert.equal(firstAgent.architectureId, first.architectureCandidate.id);
assert.equal(secondAgent.architectureId, second.architectureCandidate.id);
assert.equal(firstReceipt.architectureId, first.architectureCandidate.id);
assert.equal(secondReceipt.architectureId, second.architectureCandidate.id);
assert.equal(firstReceipt.previousArchitectureId, null);
assert.equal(secondReceipt.previousArchitectureId, first.architectureCandidate.id);
assert.equal(secondReceipt.plan.previousArchitectureId, first.architectureCandidate.id);
assert.equal(firstLedgerReceipt.architectureId, first.architectureCandidate.id);
assert.equal(secondLedgerReceipt.architectureId, second.architectureCandidate.id);
assert.equal(verifiedLedger.restoreAgentRuns()[1].architectureId, first.architectureCandidate.id);
assert.equal(nextLedger.restoreAgentRuns()[2].architectureId, second.architectureCandidate.id);
assert.equal(firstArchitectureResults.returnedCount, 1);
assert.equal(secondArchitectureResults.returnedCount, 1);
assert.equal(firstArchitectureResults.results[0].architectureId, first.architectureCandidate.id);
assert.equal(secondArchitectureResults.results[0].architectureId, second.architectureCandidate.id);
assert.equal(firstArchitectureResults.dataOnly, true);
assert.equal(firstArchitectureResults.historicalOnly, true);
assert.notEqual(firstAgent.planner, secondAgent.planner);
assert.notEqual(firstAgent.runner, secondAgent.runner);
assert.equal(secondAgent.runner.policy.maxEpisodes, 3);
assert.equal(firstReceipt.memoryContext.resultCount, 1);
assert.equal(secondReceipt.memoryContext.resultCount, 2);
assert.equal(secondReceipt.run.priorWorldModelHistoryLength, 2);
assert.deepEqual(firstReceipt.run.actionEvidence, ['PROVEN']);
assert.deepEqual(secondReceipt.run.actionEvidence, ['PROVEN']);
assert.equal(firstReceipt.authorityTransferred, false);
assert.equal(secondReceipt.authorityTransferred, false);
assert.equal(Object.hasOwn(secondReceipt, 'adoption'), false);
assert.equal(Object.hasOwn(secondReceipt, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ARCHITECTURE_TRANSITION_OK from=${firstReceipt.architectureId} `
  + `to=${secondReceipt.architectureId} predecessor=${secondReceipt.previousArchitectureId} `
  + `firstMemory=${firstReceipt.memoryContext.resultCount} secondMemory=${secondReceipt.memoryContext.resultCount} `
  + `attributionA=${firstArchitectureResults.returnedCount} attributionB=${secondArchitectureResults.returnedCount} `
  + `freshPlanner=true freshRunner=true proof=${secondReceipt.run.actionEvidence[0]} `
  + `authorityTransferred=${secondReceipt.authorityTransferred}`
);
