import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureAgent,
  agentFromAdoptedArchitecture,
  isTrustedAgentArchitectureAgent
} from '../src/agent-architecture-runtime.mjs';
import { AgentArchitectureDiscoveryRunner } from '../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'architecture-runtime-boundary-planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'architecture-runtime-boundary-planner-runtime'
  })
});
const discoveryRunner = new AgentArchitectureDiscoveryRunner({
  proposalRunner: new AgentArchitectureProposalRunner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'proposeArchitectureDirect',
      timeoutMs: 2000
    })
  })
});
const evaluationCase = new AgentPlannerCase({
  id: 'architecture-runtime-boundary-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'architecture-runtime-boundary-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'architecture-runtime-boundary-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
});
const discovery = discoveryRunner.discover({
  goal: 'build one bounded architecture agent',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
const agent = agentFromAdoptedArchitecture(discovery.adoption.adoption);
assert.equal(isTrustedAgentArchitectureAgent(agent), true);
assert.equal(Object.isFrozen(agent), true);

const secondAgent = agentFromAdoptedArchitecture(discovery.adoption.adoption);
assert.notEqual(secondAgent, agent);
assert.notEqual(secondAgent.planner, agent.planner);

assert.throws(
  () => agentFromAdoptedArchitecture(Object.create(Object.getPrototypeOf(discovery.adoption.adoption))),
  /trusted adoption evidence/
);
const forgedAgent = Object.create(Object.getPrototypeOf(agent));
assert.equal(isTrustedAgentArchitectureAgent(forgedAgent), false);
assert.throws(
  () => forgedAgent.run({ goal: 'graph', context: evaluationCase.context }),
  /exact trusted runtime/
);
assert.throws(
  () => agent.run({
    goal: 'graph',
    context: evaluationCase.context,
    stopOnResearchRequired: 'yes'
  }),
  /must be boolean/
);
assert.throws(
  () => agentFromAdoptedArchitecture(discovery.adoption.adoption, { toolRegistry: {} }),
  /trusted ToolRegistry/
);
assert.throws(
  () => new AgentArchitectureAgent({
    adoption: discovery.adoption.adoption,
    candidate: agent.candidate,
    planner: agent.planner,
    runner: agent.runner
  }),
  /trusted adopted bundle/
);

assert.equal(agent.deployed, false);
assert.equal('promoted' in agent, false);
assert.equal('constitutionalCore' in agent, false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_RUNTIME_BOUNDARY_OK freshPlanner=true `
  + `forgedAdoptionRejected=true forgedAgentRejected=true invalidOptionRejected=true `
  + `toolBoundaryRejected=true deployment=false constitutionalMutation=false`
);
