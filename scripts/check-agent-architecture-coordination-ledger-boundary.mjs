import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureCoordinationRunner,
  isTrustedAgentArchitectureCoordinationReport
} from '../src/agent-architecture-coordination.mjs';
import { AgentArchitectureDiscoveryRunner } from '../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { agentFromAdoptedArchitecture } from '../src/agent-architecture-runtime.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function buildAgent() {
  const plannerCandidate = new AgentPlannerCandidate({
    id: 'architecture-coordination-ledger-boundary-planner',
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphCoordination',
        timeoutMs: 2000
      }),
      plannerId: 'architecture-coordination-ledger-boundary-planner'
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
      id: 'architecture-coordination-ledger-boundary-case',
      domain: 'graph',
      goal: 'graph',
      context: {
        taskId: 'architecture-coordination-ledger-boundary-task',
        description: 'Find a graph path'
      },
      task: {
        id: 'architecture-coordination-ledger-boundary-task',
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
const report = runner.run({
  agents: [first, second],
  goal: 'graph',
  context: {
    taskId: 'architecture-coordination-ledger-boundary-task',
    description: 'Find a graph path'
  },
  reproduction: 'architecture-coordination-ledger-boundary-proof'
});
assert.equal(isTrustedAgentArchitectureCoordinationReport(report), true);

const ledger = new EvidenceLedger();
ledger.appendArchitectureCoordination(report);
const serialized = ledger.serialize();
const restored = EvidenceLedger.fromSerialized(serialized).restoreArchitectureCoordination();
assert.equal(restored.length, 1);
assert.equal(isTrustedAgentArchitectureCoordinationReport(restored[0]), false);
assert.equal('rounds' in restored[0], true);
assert.equal('agents' in restored[0], false);
assert.equal('runReport' in restored[0].rounds[0].members[0], false);
assert.equal('runner' in restored[0], false);
assert.equal('authority' in restored[0], false);

assert.throws(
  () => ledger.appendArchitectureCoordination(Object.freeze({ ...report })),
  /trusted coordination report/
);
const forgedReport = Object.create(Object.getPrototypeOf(report));
assert.equal(isTrustedAgentArchitectureCoordinationReport(forgedReport), false);
assert.throws(
  () => ledger.appendArchitectureCoordination(forgedReport),
  /trusted coordination report/
);

const tampered = JSON.parse(serialized);
tampered.records[0].payload.peerMessages[0][0].proven = false;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /peer message .* does not match|fingerprint verification failed|hash verification failed/
);

const tamperedFingerprint = JSON.parse(serialized);
tamperedFingerprint.records[0].payload.transcriptFingerprint = 'sha256:forged';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedFingerprint)),
  /fingerprint verification failed|hash verification failed/
);

console.log(
  `FLUID_AGENT_ARCHITECTURE_COORDINATION_LEDGER_BOUNDARY_OK `
  + `forgedReportRejected=true restoredAuthority=false tamperRejected=true `
  + `trustedRestored=${isTrustedAgentArchitectureCoordinationReport(restored[0])}`
);
