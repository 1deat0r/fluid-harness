import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import {
  MemoryAwareAgentCoordinationRunner
} from '../src/memory-agent-coordination.mjs';
import {
  MemoryAwareAgentSessionReport,
  MemoryAwareAgentSessionRunner,
  isTrustedMemoryAwareAgentSessionReport,
  isTrustedMemoryAwareAgentSessionRunner
} from '../src/memory-agent-session.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const proposalRunner = new AgentArchitectureProposalRunner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'proposeArchitectureDirect',
    timeoutMs: 2000
  })
});
const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-session-boundary-planner',
  description: 'A deterministic process-isolated graph planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphCoordination',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-session-boundary-planner-runtime'
  })
});
const evaluationCase = new AgentPlannerCase({
  id: 'memory-aware-session-boundary-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'memory-aware-session-boundary-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'memory-aware-session-boundary-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles.length === 1
    && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
});

function buildLedger() {
  const sourceReport = new BoundedAgentRunner().run({
    episodes: [{
      task: {
        id: 'memory-aware-session-boundary-history',
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
  return EvidenceLedger.fromSerialized(ledger.serialize());
}

function buildSession() {
  return new MemoryAwareAgentSessionRunner({
    proposalRunner,
    agentCount: 2,
    maxRounds: 2,
    minimumProvenAgents: 2
  });
}

function validOptions(ledger) {
  return {
    architectureGoal: 'discover a bounded graph architecture',
    agentGoal: 'graph',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 }),
    ledger,
    query: { keywords: ['graph-algorithms'], limit: 3 },
    context: {
      taskId: 'memory-aware-session-boundary-task',
      description: 'Find a graph path'
    }
  };
}

const session = buildSession();
assert.equal(isTrustedMemoryAwareAgentSessionRunner(session), true);
assert.throws(
  () => new MemoryAwareAgentSessionRunner({
    proposalRunner,
    agentCount: 1
  }),
  /at least 2/
);
assert.throws(
  () => new MemoryAwareAgentSessionRunner({
    proposalRunner,
    agentCount: 5
  }),
  /cannot exceed 4/
);
assert.throws(
  () => new MemoryAwareAgentSessionRunner({
    proposalRunner,
    maxRounds: 0
  }),
  /positive safe integer/
);
assert.throws(
  () => new MemoryAwareAgentSessionRunner({
    proposalRunner,
    maxRounds: 5
  }),
  /cannot exceed 4/
);
assert.throws(
  () => new MemoryAwareAgentSessionRunner({
    proposalRunner,
    agentCount: 2,
    minimumProvenAgents: 3
  }),
  /cannot exceed agentCount/
);
assert.throws(
  () => new MemoryAwareAgentSessionRunner({
    proposalRunner: Object.create(Object.getPrototypeOf(proposalRunner))
  }),
  /trusted proposal runner/
);
const forgedRunner = Object.create(Object.getPrototypeOf(session));
assert.equal(isTrustedMemoryAwareAgentSessionRunner(forgedRunner), false);
assert.throws(
  () => forgedRunner.run({}),
  /exact trusted runner/
);

const ledger = buildLedger();
assert.throws(
  () => session.run({ ...validOptions(ledger), ledger: {} }),
  /trusted evidence ledger/
);
const tamperedSerialized = ledger.serialize().replace(
  'memory-aware-session-boundary-history',
  'forged-memory-aware-session-history'
);
assert.notEqual(tamperedSerialized, ledger.serialize());
assert.throws(
  () => EvidenceLedger.fromSerialized(tamperedSerialized),
  /hash verification failed/
);
const accessorOptions = validOptions(ledger);
Object.defineProperty(accessorOptions, 'query', {
  enumerable: true,
  get() {
    return { keywords: ['graph-algorithms'] };
  }
});
assert.throws(
  () => session.run(accessorOptions),
  /data properties/
);
assert.throws(
  () => session.run({ ...validOptions(ledger), adoptionAuthority: {} }),
  /constructor-owned/
);
assert.throws(
  () => session.run({ ...validOptions(ledger), context: [] }),
  /plain object/
);
assert.throws(
  () => session.run({ ...validOptions(ledger), query: [] }),
  /plain object/
);
const cyclicContext = {};
cyclicContext.self = cyclicContext;
assert.throws(
  () => session.run({ ...validOptions(ledger), context: cyclicContext }),
  /cycle|cyclic|JSON-compatible/i
);
const cyclicQuery = {};
cyclicQuery.self = cyclicQuery;
assert.throws(
  () => session.run({ ...validOptions(ledger), query: cyclicQuery }),
  /cycle|cyclic|JSON-compatible/i
);
assert.throws(
  () => session.run({ ...validOptions(ledger), plannerCandidates: [{}] }),
  /trusted/
);
assert.throws(
  () => session.run({ ...validOptions(ledger), cases: [{}] }),
  /trusted/
);
assert.throws(
  () => session.run({ ...validOptions(ledger), agentGoal: '' }),
  /non-empty string/
);
assert.throws(
  () => session.run({ ...validOptions(ledger), architectureGoal: '' }),
  /non-empty string/
);
assert.throws(
  () => new MemoryAwareAgentCoordinationRunner({
    agentCount: 2,
    maxRounds: 2,
    minimumProvenAgents: 2
  }).run({
    adoption: {},
    ledger,
    agentGoal: 'graph'
  }),
  /trusted adoption evidence/
);
assert.throws(
  () => new MemoryAwareAgentSessionReport({
    runner: session,
    discoverySummary: {},
    coordination: {},
    architectureGoal: 'architecture',
    agentGoal: 'graph',
    query: {},
    context: {},
    reproduction: 'forged'
  }),
  /trusted finite orchestration evidence/
);

const report = session.run(validOptions(ledger));
assert.equal(isTrustedMemoryAwareAgentSessionReport(report), true);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(report.adopted, true);
assert.equal(report.finalQuorumMet, true);
assert.equal(report.allRoundsProven, true);
assert.equal(report.persistenceComplete, true);
assert.equal(report.discoverySummary.dataOnly, true);
assert.equal(report.discoverySummary.authorityTransferred, false);
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.discoverySummary), true);
assert.equal(Object.hasOwn(report, 'discovery'), false);
assert.equal(Object.hasOwn(report, 'adoption'), false);
assert.equal(Object.hasOwn(report, 'ledger'), false);
assert.equal(Object.hasOwn(report.discoverySummary, 'primary'), false);
assert.equal(Object.hasOwn(report.discoverySummary, 'reproducibility'), false);
assert.equal(Object.hasOwn(report.coordination, 'agents'), false);
assert.equal(Object.hasOwn(report.coordination, 'adoption'), false);
assert.equal(Object.hasOwn(report.coordination.rounds[0].members[0], 'runReport'), false);
assert.throws(() => {
  report.dataOnly = false;
}, TypeError);
const forgedReport = Object.create(Object.getPrototypeOf(report));
assert.equal(isTrustedMemoryAwareAgentSessionReport(forgedReport), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_SESSION_BOUNDARY_OK forgedRunnerRejected=true `
  + `invalidConfigRejected=true forgedLedgerRejected=true tamperedLedgerRejected=true `
  + `accessorRejected=true cyclicRejected=true invalidDiscoveryInputsRejected=true `
  + `proofSuppressed=${!Object.hasOwn(report.coordination.rounds[0].members[0], 'runReport')} `
  + `summaryOnly=${report.dataOnly} trustedReport=${isTrustedMemoryAwareAgentSessionReport(report)}`
);
