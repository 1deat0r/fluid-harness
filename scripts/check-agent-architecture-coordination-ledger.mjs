import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureCoordinationRunner,
  isTrustedAgentArchitectureCoordinationReport
} from '../src/agent-architecture-coordination.mjs';
import { AgentArchitectureDiscoveryRunner } from '../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import {
  agentFromAdoptedArchitecture,
  isTrustedAgentArchitectureAgent
} from '../src/agent-architecture-runtime.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import {
  EvidenceLedger,
  isTrustedEvidenceLedger
} from '../src/evidence-ledger.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function buildAgent() {
  const plannerCandidate = new AgentPlannerCandidate({
    id: 'architecture-coordination-ledger-planner',
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphCoordination',
        timeoutMs: 2000
      }),
      plannerId: 'architecture-coordination-ledger-planner'
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
    goal: 'archive coordinated bounded agents',
    plannerCandidates: [plannerCandidate],
    cases: [new AgentPlannerCase({
      id: 'architecture-coordination-ledger-case',
      domain: 'graph',
      goal: 'graph',
      context: {
        taskId: 'architecture-coordination-ledger-task',
        description: 'Find a graph path'
      },
      task: {
        id: 'architecture-coordination-ledger-task',
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
assert.equal(isTrustedAgentArchitectureAgent(first), true);
assert.equal(isTrustedAgentArchitectureAgent(second), true);
const report = new AgentArchitectureCoordinationRunner({
  maxRounds: 2,
  maxAgents: 2,
  minimumProvenAgents: 2
}).run({
  agents: [first, second],
  goal: 'graph',
  context: {
    taskId: 'architecture-coordination-ledger-task',
    description: 'Find a graph path'
  },
  reproduction: 'architecture-coordination-ledger-proof'
});

assert.equal(isTrustedAgentArchitectureCoordinationReport(report), true);
const ledger = new EvidenceLedger();
const entry = ledger.appendArchitectureCoordination(report);
assert.equal(isTrustedEvidenceLedger(ledger), true);
assert.equal(entry.kind, 'architecture-coordination');
assert.equal(entry.payload.dataOnly, true);
assert.equal(entry.payload.messagesDataOnly, true);
assert.equal(entry.payload.transcriptFingerprint.startsWith('sha256:'), true);
assert.equal(ledger.verify(), true);

const serialized = ledger.serialize();
const restored = EvidenceLedger.fromSerialized(serialized);
assert.equal(restored.verify(), true);
assert.deepEqual(restored.serialize(), serialized);
const transcripts = restored.restoreArchitectureCoordination();
assert.equal(transcripts.length, 1);
assert.equal(transcripts[0].dataOnly, true);
assert.equal(transcripts[0].roundCount, 2);
assert.equal(transcripts[0].finalQuorumMet, true);
assert.equal(transcripts[0].peerMessages[1].length, 2);
assert.equal(Object.isFrozen(transcripts[0]), true);
assert.equal(Object.isFrozen(transcripts[0].rounds[0].members[0]), true);
assert.equal(isTrustedAgentArchitectureCoordinationReport(transcripts[0]), false);
assert.equal('agents' in transcripts[0], false);
assert.equal('runReport' in transcripts[0].rounds[0].members[0], false);
assert.equal('planner' in transcripts[0].rounds[0].members[0], false);
assert.equal('authority' in transcripts[0], false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_COORDINATION_LEDGER_OK kind=${entry.kind} `
  + `transcripts=${transcripts.length} rounds=${transcripts[0].roundCount} `
  + `quorum=${transcripts[0].finalQuorumMet} dataOnly=${transcripts[0].dataOnly} `
  + `trustedRestored=${isTrustedAgentArchitectureCoordinationReport(transcripts[0])}`
);
