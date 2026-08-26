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
  MemoryAwareAgentCoordinationReport,
  MemoryAwareAgentCoordinationRunner,
  isTrustedMemoryAwareAgentCoordinationReport,
  isTrustedMemoryAwareAgentCoordinationRunner
} from '../src/memory-agent-coordination.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-coordination-boundary-planner-candidate',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphCoordination',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-coordination-boundary-planner'
  })
});
const architectureCandidate = new AgentArchitectureCandidate({
  id: 'memory-aware-coordination-boundary-architecture-candidate',
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
  id: 'memory-aware-coordination-boundary-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-coordination-boundary-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-coordination-boundary-task',
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
    task: {
      id: 'memory-aware-coordination-boundary-history',
      description: 'Find a graph path'
    },
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
const runner = new MemoryAwareAgentCoordinationRunner({
  agentCount: 2,
  maxRounds: 2,
  minimumProvenAgents: 2
});

assert.equal(isTrustedMemoryAwareAgentCoordinationRunner(runner), true);
assert.throws(
  () => new MemoryAwareAgentCoordinationRunner({ agentCount: 1 }),
  /at least 2/
);
assert.throws(
  () => new MemoryAwareAgentCoordinationRunner({ agentCount: 5 }),
  /cannot exceed 4/
);
assert.throws(
  () => new MemoryAwareAgentCoordinationRunner({ maxRounds: 0 }),
  /positive safe integer/
);
assert.throws(
  () => new MemoryAwareAgentCoordinationRunner({ maxRounds: 5 }),
  /cannot exceed 4/
);
assert.throws(
  () => new MemoryAwareAgentCoordinationRunner({
    agentCount: 2,
    minimumProvenAgents: 3
  }),
  /cannot exceed agentCount/
);
assert.throws(
  () => runner.run({
    adoption: Object.create(Object.getPrototypeOf(adoption.adoption)),
    ledger: verifiedLedger,
    agentGoal: 'graph'
  }),
  /trusted adoption evidence/
);
assert.throws(
  () => runner.run({
    adoption: {},
    ledger: verifiedLedger,
    agentGoal: 'graph'
  }),
  /trusted adoption evidence/
);
assert.throws(
  () => runner.run({
    adoption: adoption.adoption,
    ledger: {},
    agentGoal: 'graph'
  }),
  /trusted evidence ledger/
);
const tamperedSerialized = ledger.serialize().replace(
  'memory-aware-coordination-boundary-history',
  'forged-memory-aware-coordination-history'
);
assert.notEqual(tamperedSerialized, ledger.serialize());
assert.throws(
  () => EvidenceLedger.fromSerialized(tamperedSerialized),
  /hash verification failed/
);
const accessorOptions = {
  adoption: adoption.adoption,
  ledger: verifiedLedger,
  agentGoal: 'graph'
};
Object.defineProperty(accessorOptions, 'query', {
  enumerable: true,
  get() {
    return { keywords: ['graph-algorithms'] };
  }
});
assert.throws(
  () => runner.run(accessorOptions),
  /data properties/
);
assert.throws(
  () => Object.create(Object.getPrototypeOf(runner)).run({
    adoption: adoption.adoption,
    ledger: verifiedLedger,
    agentGoal: 'graph'
  }),
  /exact trusted runner/
);
assert.throws(
  () => runner.run({
    adoption: adoption.adoption,
    ledger: verifiedLedger,
    agentGoal: 'graph',
    query: []
  }),
  /plain object/
);
assert.throws(
  () => runner.run({
    adoption: adoption.adoption,
    ledger: verifiedLedger,
    agentGoal: 'graph',
    context: []
  }),
  /plain object or null/
);
const cyclicContext = {};
cyclicContext.self = cyclicContext;
assert.throws(
  () => runner.run({
    adoption: adoption.adoption,
    ledger: verifiedLedger,
    agentGoal: 'graph',
    context: cyclicContext
  }),
  /cycle|cyclic|JSON-compatible/i
);
assert.throws(
  () => runner.run({
    adoption: adoption.adoption,
    ledger: verifiedLedger,
    agentGoal: 'graph',
    unexpected: true
  }),
  /data properties/
);
assert.throws(
  () => new MemoryAwareAgentCoordinationReport({
    runner,
    rounds: [],
    peerMessages: [],
    persistence: [],
    goal: 'graph',
    query: {},
    context: null,
    reproduction: 'forged',
    ledgerLengthBefore: 0,
    ledgerLengthAfter: 0
  }),
  /trusted finite round evidence/
);

const report = runner.run({
  adoption: adoption.adoption,
  ledger: verifiedLedger,
  agentGoal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 3 },
  context: {
    taskId: 'memory-aware-coordination-boundary-next-task',
    description: 'Find a graph path'
  }
});
assert.equal(isTrustedMemoryAwareAgentCoordinationReport(report), true);
assert.equal(report.allRoundsQuorumMet, true);
assert.equal(report.allRoundsProven, true);
assert.equal(report.persistenceComplete, true);
assert.equal(report.ledgerLengthAfter, 5);
assert.equal(report.messagesDataOnly, true);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.peerMessages[0]), true);
assert.equal(Object.isFrozen(report.persistence[0]), true);
assert.equal(Object.isFrozen(report.persistence[0][0]), true);
assert.equal(Object.hasOwn(report, 'agents'), false);
assert.equal(Object.hasOwn(report, 'adoption'), false);
assert.equal(Object.hasOwn(report, 'ledger'), false);
assert.equal(Object.hasOwn(report.rounds[0], 'agents'), false);
assert.equal(Object.hasOwn(report.rounds[0].members[0], 'agent'), false);
assert.equal(Object.hasOwn(report.rounds[0].members[0], 'runReport'), false);
assert.throws(() => {
  report.dataOnly = false;
}, TypeError);
const forgedReport = Object.create(Object.getPrototypeOf(report));
assert.equal(isTrustedMemoryAwareAgentCoordinationReport(forgedReport), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_COORDINATION_BOUNDARY_OK forgedAdoptionRejected=true `
  + `plainAdoptionRejected=true forgedLedgerRejected=true tamperedLedgerRejected=true `
  + `accessorRejected=true configRejected=true forgedRunnerRejected=true `
  + `cyclicRejected=true proofSuppressed=${!Object.hasOwn(report.rounds[0].members[0], 'runReport')} `
  + `summaryOnly=${report.dataOnly} trustedReport=${isTrustedMemoryAwareAgentCoordinationReport(report)}`
);
