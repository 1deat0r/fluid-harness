import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentArchitectureDiscoveryRunner } from '../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES,
  STRUCTURED_MEMORY_CONTEXT_SOURCE
} from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { buildDistributionShiftFixture } from './fixtures/distribution-shift.mjs';

const { report: distributionShift } = buildDistributionShiftFixture({
  prefix: 'architecture-research-proposal'
});
const ledger = new EvidenceLedger();
ledger.appendDistributionShift(distributionShift);
const memory = memoryFromLedger({
  ledger: EvidenceLedger.fromSerialized(ledger.serialize()),
  idPrefix: 'architecture-research-proposal',
  maxEntries: 8
});
const researchContext = buildStructuredMemoryContext({
  memory,
  query: {
    source: MEMORY_SOURCES.DISTRIBUTION_SHIFT,
    strategyKey: 'distribution-shift',
    keywords: ['distribution-shift', 'weakness-exposed']
  }
});
const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'architecture-research-registered-planner',
  description: 'A deterministic process-isolated graph planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'architecture-research-registered-planner-runtime'
  })
});
const proposalRunner = new AgentArchitectureProposalRunner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'proposeArchitectureFromResearch',
    timeoutMs: 2000
  }),
  maxProposals: 2
});
const discovery = new AgentArchitectureDiscoveryRunner({ proposalRunner }).discover({
  goal: 'use robustness research to propose a bounded agent architecture',
  plannerCandidates: [plannerCandidate],
  researchContext,
  cases: [new AgentPlannerCase({
    id: 'architecture-research-proposal-case',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'architecture-research-proposal-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'architecture-research-proposal-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (runReport) => runReport?.completed === true
      && runReport.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
  })],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(discovery.proposalReport.researchContext.source, STRUCTURED_MEMORY_CONTEXT_SOURCE);
assert.equal(discovery.proposalReport.researchContext.resultCount, 1);
assert.equal(discovery.proposals.length, 1);
assert.equal(discovery.proposals[0].components.researchSource, STRUCTURED_MEMORY_CONTEXT_SOURCE);
assert.equal(discovery.proposals[0].components.researchSignal, 'weakness-exposed');
assert.equal(discovery.proposals[0].components.researchResultCount, 1);
assert.equal(discovery.proposals[0].components.response, 'robustness-review');
assert.equal(discovery.candidates.length, 1);
assert.equal(discovery.primary.complete, true);
assert.equal(discovery.reproduction.complete, true);
assert.equal(discovery.reproducibility.reproducible, true);
assert.equal(discovery.adopted, true);
assert.equal(discovery.deployed, false);
assert.equal(discovery.adoptedCandidate.plannerCandidate.id, plannerCandidate.id);
assert.equal(
  discovery.primary.winner.plannerReport.results[0].production.results[0].proven,
  true
);

console.log(
  `FLUID_AGENT_ARCHITECTURE_RESEARCH_PROPOSAL_OK `
  + `researchSource=${discovery.proposalReport.researchContext.source} `
  + `signal=${discovery.proposals[0].components.researchSignal} `
  + `proposals=${discovery.proposals.length} resolved=${discovery.candidates.length} `
  + `adopted=${discovery.adopted} replay=${discovery.reproducibility.reproducible} `
  + `parentProof=PROVEN deployed=${discovery.deployed}`
);
