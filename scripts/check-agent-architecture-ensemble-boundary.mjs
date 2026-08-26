import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentArchitectureDiscoveryRunner } from '../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import {
  AgentArchitectureEnsembleMemberReport,
  AgentArchitectureEnsembleRunner,
  isTrustedAgentArchitectureEnsembleReport
} from '../src/agent-architecture-ensemble.mjs';
import { agentFromAdoptedArchitecture } from '../src/agent-architecture-runtime.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function buildAgent() {
  const plannerCandidate = new AgentPlannerCandidate({
    id: 'architecture-ensemble-boundary-planner',
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphDirect',
        timeoutMs: 2000
      }),
      plannerId: 'architecture-ensemble-boundary-planner'
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
    goal: 'build independent bounded agents',
    plannerCandidates: [plannerCandidate],
    cases: [new AgentPlannerCase({
      id: 'architecture-ensemble-boundary-case',
      domain: 'graph',
      goal: 'graph',
      context: {
        taskId: 'architecture-ensemble-boundary-task',
        description: 'Find a graph path'
      },
      task: {
        id: 'architecture-ensemble-boundary-task',
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
const runner = new AgentArchitectureEnsembleRunner({
  maxAgents: 2,
  minimumProvenAgents: 2
});
const validReport = runner.run({
  agents: [first, second],
  goal: 'graph',
  context: {
    taskId: 'architecture-ensemble-boundary-task',
    description: 'Find a graph path'
  }
});
assert.equal(validReport.quorumMet, true);
assert.equal(isTrustedAgentArchitectureEnsembleReport(validReport), true);

assert.throws(
  () => new AgentArchitectureEnsembleRunner({ maxAgents: 1 }),
  /at least 2/
);
assert.throws(
  () => new AgentArchitectureEnsembleRunner({ maxAgents: 2, minimumProvenAgents: 3 }),
  /cannot exceed/
);
assert.throws(
  () => runner.run({
    agents: [first, first],
    goal: 'graph',
    context: { taskId: 'architecture-ensemble-boundary-task', description: 'Find a graph path' }
  }),
  /distinct/
);
const forgedAgent = Object.create(Object.getPrototypeOf(first));
assert.throws(
  () => runner.run({
    agents: [first, forgedAgent],
    goal: 'graph',
    context: { taskId: 'architecture-ensemble-boundary-task', description: 'Find a graph path' }
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
const cyclicContext = {};
cyclicContext.self = cyclicContext;
assert.throws(
  () => runner.run({ agents: [first, second], goal: 'graph', context: cyclicContext }),
  /cycle|JSON-compatible/
);
assert.throws(
  () => new AgentArchitectureEnsembleMemberReport({ agent: first, index: 0 }),
  /trusted agent evidence/
);

const failureFirst = buildAgent();
const failureSecond = buildAgent();
failureSecond.runner.cycleRunner.core.shutdown('ensemble boundary shutdown');
const failureReport = runner.run({
  agents: [failureFirst, failureSecond],
  goal: 'graph',
  context: {
    taskId: 'architecture-ensemble-boundary-task',
    description: 'Find a graph path'
  },
  reproduction: 'architecture-ensemble-failure'
});
assert.equal(failureReport.quorumMet, false);
assert.equal(failureReport.provenAgents, 1);
assert.equal(failureReport.allComplete, false);
assert.equal(failureReport.members[1].runReport?.completed, false);

const forgedReport = Object.create(Object.getPrototypeOf(validReport));
assert.equal(isTrustedAgentArchitectureEnsembleReport(forgedReport), false);
assert.equal(validReport.deployed, false);
assert.equal('promoted' in validReport, false);
assert.equal('constitutionalCore' in validReport, false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_ENSEMBLE_BOUNDARY_OK duplicateRejected=true `
  + `forgedRejected=true invalidConfigRejected=true cyclicRejected=true `
  + `failureQuorumRejected=${!failureReport.quorumMet} deployment=false constitutionalMutation=false`
);
