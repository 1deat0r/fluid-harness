import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentArchitectureDiscoveryRunner } from '../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import {
  AgentArchitectureCoordinationRunner,
  isTrustedAgentArchitectureCoordinationReport
} from '../src/agent-architecture-coordination.mjs';
import { agentFromAdoptedArchitecture } from '../src/agent-architecture-runtime.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'architecture-coordination-registered-planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphCoordination',
      timeoutMs: 2000
    }),
    plannerId: 'architecture-coordination-planner'
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
    id: 'architecture-coordination-case',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'architecture-coordination-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'architecture-coordination-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (report) => report?.completed === true
  })],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
const first = agentFromAdoptedArchitecture(discovery.adoption.adoption);
const second = agentFromAdoptedArchitecture(discovery.adoption.adoption);
const report = new AgentArchitectureCoordinationRunner({
  maxRounds: 2,
  maxAgents: 2,
  minimumProvenAgents: 2
}).run({
  agents: [first, second],
  goal: 'graph',
  context: {
    taskId: 'architecture-coordination-task',
    description: 'Find a graph path'
  },
  reproduction: 'architecture-coordination-proof'
});

assert.equal(isTrustedAgentArchitectureCoordinationReport(report), true);
assert.equal(report.roundCount, 2);
assert.equal(report.rounds.length, 2);
assert.equal(report.allRoundsQuorumMet, true);
assert.equal(report.allRoundsComplete, true);
assert.equal(report.allRoundsProven, true);
assert.equal(report.finalQuorumMet, true);
assert.equal(report.messagesDataOnly, true);
assert.equal(Object.isFrozen(report.peerMessages[0]), true);
assert.equal(report.peerMessages[0][0].proven, true);
assert.equal('runReport' in report.peerMessages[0][0], false);
assert.equal(report.rounds[0].members[0].runReport.cycles[0].action.input.coordinationRound, 1);
assert.equal(report.rounds[0].members[0].runReport.cycles[0].action.input.peerEvidenceCount, 0);
assert.equal(report.rounds[1].members[0].runReport.cycles[0].action.input.coordinationRound, 2);
assert.equal(report.rounds[1].members[0].runReport.cycles[0].action.input.peerEvidenceCount, 2);
assert.equal(report.deployed, false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_COORDINATION_OK rounds=${report.roundCount} `
  + `agents=${report.rounds[0].attemptedAgents} finalQuorum=${report.finalQuorumMet} `
  + `messagesDataOnly=${report.messagesDataOnly} round2PeerEvidence=${report.rounds[1].members[0].runReport.cycles[0].action.input.peerEvidenceCount} `
  + `deployment=false`
);
