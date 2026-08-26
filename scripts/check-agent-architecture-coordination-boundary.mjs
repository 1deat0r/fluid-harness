import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentArchitectureDiscoveryRunner } from '../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import {
  AgentArchitectureCoordinationReport,
  AgentArchitectureCoordinationRunner,
  isTrustedAgentArchitectureCoordinationReport
} from '../src/agent-architecture-coordination.mjs';
import { agentFromAdoptedArchitecture } from '../src/agent-architecture-runtime.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function buildAgent() {
  const plannerCandidate = new AgentPlannerCandidate({
    id: 'architecture-coordination-boundary-planner',
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphCoordination',
        timeoutMs: 2000
      }),
      plannerId: 'architecture-coordination-boundary-planner'
    })
  });
  const discovery = new AgentArchitectureDiscoveryRunner({
    proposalRunner: new AgentArchitectureProposalRunner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'proposeArchitectureDirect',
        timeoutMs: 2000
      })
    })
  }).discover({
    goal: 'build coordinated bounded agents',
    plannerCandidates: [plannerCandidate],
    cases: [new AgentPlannerCase({
      id: 'architecture-coordination-boundary-case',
      domain: 'graph',
      goal: 'graph',
      context: {
        taskId: 'architecture-coordination-boundary-task',
        description: 'Find a graph path'
      },
      task: {
        id: 'architecture-coordination-boundary-task',
        description: 'Find a graph path'
      },
      adversarial: true,
      expected: (report) => report?.completed === true
    })],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
  return agentFromAdoptedArchitecture(discovery.adoption.adoption);
}

const first = buildAgent();
const second = buildAgent();
const runner = new AgentArchitectureCoordinationRunner({
  maxRounds: 2,
  maxAgents: 2,
  minimumProvenAgents: 2
});
const validReport = runner.run({
  agents: [first, second],
  goal: 'graph',
  context: {
    taskId: 'architecture-coordination-boundary-task',
    description: 'Find a graph path'
  }
});
assert.equal(isTrustedAgentArchitectureCoordinationReport(validReport), true);
assert.equal(validReport.messagesDataOnly, true);

assert.throws(
  () => new AgentArchitectureCoordinationRunner({ maxRounds: 0 }),
  /positive safe integer/
);
assert.throws(
  () => new AgentArchitectureCoordinationRunner({ maxAgents: 1 }),
  /at least 2/
);
assert.throws(
  () => new AgentArchitectureCoordinationRunner({ maxAgents: 2, minimumProvenAgents: 3 }),
  /cannot exceed/
);
assert.throws(
  () => runner.run({
    agents: [first, first],
    goal: 'graph',
    context: { taskId: 'architecture-coordination-boundary-task', description: 'Find a graph path' }
  }),
  /distinct/
);
const forgedAgent = Object.create(Object.getPrototypeOf(first));
assert.throws(
  () => runner.run({
    agents: [first, forgedAgent],
    goal: 'graph',
    context: { taskId: 'architecture-coordination-boundary-task', description: 'Find a graph path' }
  }),
  /trusted runtimes/
);
assert.throws(
  () => Object.create(Object.getPrototypeOf(runner)).run({
    agents: [first, second],
    goal: 'graph'
  }),
  /exact trusted runner/
);
assert.throws(
  () => runner.run({ agents: [first, second], goal: 'graph', context: [] }),
  /plain object or null/
);
const cyclicContext = {};
cyclicContext.self = cyclicContext;
assert.throws(
  () => runner.run({ agents: [first, second], goal: 'graph', context: cyclicContext }),
  /cycle|JSON-compatible/
);
assert.throws(
  () => new AgentArchitectureCoordinationReport({
    runner,
    rounds: [],
    peerMessages: [],
    goal: 'graph',
    context: null,
    reproduction: 'forged'
  }),
  /trusted finite round evidence/
);

const failureFirst = buildAgent();
const failureSecond = buildAgent();
failureSecond.runner.cycleRunner.core.shutdown('coordination boundary shutdown');
const failureReport = runner.run({
  agents: [failureFirst, failureSecond],
  goal: 'graph',
  context: {
    taskId: 'architecture-coordination-boundary-task',
    description: 'Find a graph path'
  },
  reproduction: 'coordination-failure'
});
assert.equal(failureReport.allRoundsQuorumMet, false);
assert.equal(failureReport.finalQuorumMet, false);
assert.equal(failureReport.peerMessages[0][1].proven, false);
assert.equal(failureReport.peerMessages[1][1].proven, false);
assert.equal('runReport' in failureReport.peerMessages[0][0], false);

const forgedReport = Object.create(Object.getPrototypeOf(validReport));
assert.equal(isTrustedAgentArchitectureCoordinationReport(forgedReport), false);
assert.equal(validReport.deployed, false);
assert.equal('promoted' in validReport, false);
assert.equal('constitutionalCore' in validReport, false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_COORDINATION_BOUNDARY_OK duplicateRejected=true `
  + `forgedRejected=true invalidConfigRejected=true cyclicRejected=true `
  + `messageProofSeparated=true failureQuorumRejected=${!failureReport.finalQuorumMet} `
  + `deployment=false constitutionalMutation=false`
);
