import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureProposalRunner
} from '../src/agent-architecture-proposal.mjs';
import {
  AgentArchitectureSessionRunner,
  isTrustedAgentArchitectureSessionReport,
  isTrustedAgentArchitectureSessionRunner
} from '../src/agent-architecture-session.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function buildSession() {
  return new AgentArchitectureSessionRunner({
    proposalRunner: new AgentArchitectureProposalRunner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'proposeArchitectureDirect',
        timeoutMs: 2000
      })
    }),
    agentCount: 2,
    maxRounds: 2,
    minimumProvenAgents: 2
  });
}

function buildPlannerCandidate() {
  return new AgentPlannerCandidate({
    id: 'architecture-session-boundary-planner',
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphCoordination',
        timeoutMs: 2000
      }),
      plannerId: 'architecture-session-boundary-planner-runtime'
    })
  });
}

function buildCase() {
  return new AgentPlannerCase({
    id: 'architecture-session-boundary-case',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'architecture-session-boundary-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'architecture-session-boundary-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (report) => report?.completed === true
  });
}

function runValid(session) {
  return session.run({
    architectureGoal: 'discover a bounded graph architecture',
    agentGoal: 'graph',
    plannerCandidates: [buildPlannerCandidate()],
    cases: [buildCase()],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 }),
    context: {
      taskId: 'architecture-session-boundary-task',
      description: 'Find a graph path'
    }
  });
}

const session = buildSession();
const report = runValid(session);
assert.equal(isTrustedAgentArchitectureSessionRunner(session), true);
assert.equal(isTrustedAgentArchitectureSessionReport(report), true);
assert.equal(report.deployed, false);
assert.equal(report.constitutionalMutation, false);
assert.equal(report.coordination.deployed, false);
assert.equal(report.discovery.deployed, false);
assert.equal(Object.isFrozen(report.context), true);

assert.throws(
  () => new AgentArchitectureSessionRunner({
    proposalRunner: session.discoveryRunner.proposalRunner,
    agentCount: 1
  }),
  /at least 2/
);
assert.throws(
  () => new AgentArchitectureSessionRunner({
    proposalRunner: session.discoveryRunner.proposalRunner,
    agentCount: 2,
    minimumProvenAgents: 3
  }),
  /cannot exceed/
);
assert.throws(
  () => new AgentArchitectureSessionRunner({
    proposalRunner: session.discoveryRunner.proposalRunner,
    maxRounds: 0
  }),
  /positive safe integer/
);
assert.throws(
  () => new AgentArchitectureSessionRunner({
    proposalRunner: Object.create(Object.getPrototypeOf(session.discoveryRunner.proposalRunner))
  }),
  /trusted proposal runner/
);

const forgedRunner = Object.create(Object.getPrototypeOf(session));
assert.equal(isTrustedAgentArchitectureSessionRunner(forgedRunner), false);
assert.throws(
  () => forgedRunner.run({ architectureGoal: 'x', agentGoal: 'y' }),
  /exact trusted runner/
);
const forgedReport = Object.create(Object.getPrototypeOf(report));
assert.equal(isTrustedAgentArchitectureSessionReport(forgedReport), false);

assert.throws(
  () => session.run({
    architectureGoal: 'discover a bounded graph architecture',
    agentGoal: 'graph',
    plannerCandidates: [buildPlannerCandidate()],
    cases: [buildCase()],
    context: []
  }),
  /plain object/
);
const cyclicContext = {};
cyclicContext.self = cyclicContext;
assert.throws(
  () => session.run({
    architectureGoal: 'discover a bounded graph architecture',
    agentGoal: 'graph',
    plannerCandidates: [buildPlannerCandidate()],
    cases: [buildCase()],
    context: cyclicContext
  }),
  /cycle|JSON-compatible/
);
assert.throws(
  () => session.run({
    architectureGoal: 'discover a bounded graph architecture',
    plannerCandidates: [buildPlannerCandidate()],
    cases: [buildCase()]
  }),
  /agentGoal must be a non-empty string/
);

console.log(
  `FLUID_AGENT_ARCHITECTURE_SESSION_BOUNDARY_OK forgedRunnerRejected=true `
  + `forgedReportRejected=true invalidConfigRejected=true invalidContextRejected=true `
  + `deployment=${report.deployed} constitutionalMutation=${report.constitutionalMutation}`
);
