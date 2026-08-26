import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureProposalRunner
} from '../src/agent-architecture-proposal.mjs';
import {
  AgentArchitectureSessionRunner,
  isTrustedAgentArchitectureSessionReport
} from '../src/agent-architecture-session.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { isTrustedAgentArchitectureAgent } from '../src/agent-architecture-runtime.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'architecture-session-planner',
  description: 'A deterministic process-isolated graph planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphCoordination',
      timeoutMs: 2000
    }),
    plannerId: 'architecture-session-planner-runtime'
  })
});
const session = new AgentArchitectureSessionRunner({
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
const report = session.run({
  architectureGoal: 'discover a bounded graph architecture',
  agentGoal: 'graph',
  plannerCandidates: [plannerCandidate],
  cases: [new AgentPlannerCase({
    id: 'architecture-session-case',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'architecture-session-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'architecture-session-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (runReport) => runReport?.completed === true
  })],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 }),
  context: {
    taskId: 'architecture-session-task',
    description: 'Find a graph path'
  },
  reproduction: 'architecture-session-proof'
});

assert.equal(isTrustedAgentArchitectureSessionReport(report), true);
assert.equal(report.discovery.adopted, true);
assert.equal(report.agents.length, 2);
assert.equal(isTrustedAgentArchitectureAgent(report.agents[0]), true);
assert.equal(isTrustedAgentArchitectureAgent(report.agents[1]), true);
assert.notEqual(report.agents[0], report.agents[1]);
assert.notEqual(report.agents[0].planner, report.agents[1].planner);
assert.notEqual(report.agents[0].runner, report.agents[1].runner);
assert.equal(report.coordination.roundCount, 2);
assert.equal(report.coordination.finalQuorumMet, true);
assert.equal(report.coordination.allRoundsProven, true);
assert.equal(report.freshAgents, true);
assert.equal(report.adopted, true);
assert.equal(report.deployed, false);
assert.equal(report.constitutionalMutation, false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_SESSION_OK adopted=${report.adopted} `
  + `agents=${report.agents.length} rounds=${report.coordination.roundCount} `
  + `finalQuorum=${report.finalQuorumMet} proven=${report.coordination.allRoundsProven} `
  + `deployed=${report.deployed}`
);
