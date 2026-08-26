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
  isTrustedMemoryAwareAgentEnsembleReport,
  MemoryAwareAgentEnsembleRunner,
  memoryAwareAgentEnsembleFromArchitectureAdoption
} from '../src/memory-agent-ensemble.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-ensemble-boundary-planner-candidate',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-ensemble-boundary-planner'
  })
});
const architectureCandidate = new AgentArchitectureCandidate({
  id: 'memory-aware-ensemble-boundary-architecture-candidate',
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
  id: 'memory-aware-ensemble-boundary-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-ensemble-boundary-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-ensemble-boundary-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles.length === 1
    && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
});

function evaluate() {
  return new AgentArchitectureSearchRunner().evaluate({
    candidates: [architectureCandidate],
    cases: [evaluationCase],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
}

const adoption = new AgentArchitectureAdoptionAuthority().adopt(
  new AgentArchitectureReproducibilityAuthority().reproduce({
    searchReport: evaluate(),
    reproductionReport: evaluate(),
    candidateId: architectureCandidate.id
  })
);
assert.equal(adoption.adopted, true);

const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-ensemble-boundary-history', description: 'Find a graph path' },
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
  () => memoryAwareAgentEnsembleFromArchitectureAdoption({
    adoption: Object.create(Object.getPrototypeOf(adoption.adoption)),
    ledger: verifiedLedger
  }),
  /trusted adoption evidence/
);
assert.throws(
  () => memoryAwareAgentEnsembleFromArchitectureAdoption({
    adoption: {},
    ledger: verifiedLedger
  }),
  /trusted adoption evidence/
);
assert.throws(
  () => memoryAwareAgentEnsembleFromArchitectureAdoption({
    adoption: adoption.adoption,
    ledger: {}
  }),
  /trusted evidence ledger/
);
assert.throws(
  () => memoryAwareAgentEnsembleFromArchitectureAdoption({
    adoption: adoption.adoption,
    ledger: verifiedLedger,
    agentCount: 1
  }),
  /requires at least|positive|2/
);
assert.throws(
  () => memoryAwareAgentEnsembleFromArchitectureAdoption({
    adoption: adoption.adoption,
    ledger: verifiedLedger,
    agentCount: 5
  }),
  /cannot exceed 4/
);
const accessorOptions = { adoption: adoption.adoption, ledger: verifiedLedger };
Object.defineProperty(accessorOptions, 'agentCount', {
  enumerable: true,
  get() {
    return 2;
  }
});
assert.throws(
  () => memoryAwareAgentEnsembleFromArchitectureAdoption(accessorOptions),
  /data properties/
);
assert.throws(
  () => new MemoryAwareAgentEnsembleRunner({ maxAgents: 1 }),
  /at least 2/
);
assert.throws(
  () => new MemoryAwareAgentEnsembleRunner({ maxAgents: 2, minimumProvenAgents: 3 }),
  /cannot exceed maxAgents/
);

const agents = memoryAwareAgentEnsembleFromArchitectureAdoption({
  adoption: adoption.adoption,
  ledger: verifiedLedger,
  agentCount: 2
});
const runner = new MemoryAwareAgentEnsembleRunner({
  maxAgents: 2,
  minimumProvenAgents: 2
});
assert.throws(
  () => runner.run({ agents: [agents[0], agents[0]], goal: 'graph' }),
  /distinct/
);
assert.throws(
  () => runner.run({ agents: [{}, agents[1]], goal: 'graph' }),
  /trusted/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'keywords', {
  enumerable: true,
  get() {
    return ['graph-algorithms'];
  }
});
assert.throws(
  () => runner.run({ agents, goal: 'graph', query: accessorQuery }),
  /data properties/
);
const cyclicContext = {};
cyclicContext.self = cyclicContext;
assert.throws(
  () => runner.run({ agents, goal: 'graph', context: cyclicContext }),
  /cycle|cyclic|snapshot/i
);

const report = runner.run({
  agents,
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: {
    taskId: 'memory-aware-ensemble-boundary-next-task',
    description: 'Find a graph path'
  }
});
assert.equal(isTrustedMemoryAwareAgentEnsembleReport(report), true);
assert.equal(report.quorumMet, true);
assert.equal(report.allProven, true);
assert.equal(report.authorityTransferred, false);
assert.equal(Object.hasOwn(report, 'agents'), false);
assert.equal(Object.hasOwn(report, 'runReports'), false);
for (const member of report.members) {
  assert.equal(member.proven, true);
  assert.equal(member.dataOnly, true);
  assert.equal(member.authorityTransferred, false);
  assert.equal(Object.hasOwn(member, 'agent'), false);
  assert.equal(Object.hasOwn(member, 'runReport'), false);
}

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ENSEMBLE_BOUNDARY_OK forgedAdoptionRejected=true `
  + `plainAdoptionRejected=true forgedLedgerRejected=true accessorRejected=true `
  + `countRejected=true duplicateRejected=true proofSuppressed=${!Object.hasOwn(report.members[0], 'runReport')} `
  + `summaryOnly=${report.dataOnly} trustedReport=${isTrustedMemoryAwareAgentEnsembleReport(report)}`
);
