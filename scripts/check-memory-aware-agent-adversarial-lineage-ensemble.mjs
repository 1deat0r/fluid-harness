import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AdversarialLineageEnsembleRunner } from '../src/adversarial-lineage-ensemble.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  isTrustedMemoryAwareAgentLedgerReceipt,
  memoryAwareAgentFromLedger
} from '../src/memory-agent.mjs';
import {
  isTrustedMemoryAwareAgentEnsembleReport,
  MemoryAwareAgentEnsembleRunner
} from '../src/memory-agent-ensemble.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const cases = [
  new EvaluationCase({
    id: 'memory-aware-agent-adversarial-ensemble-success',
    domain: 'graph',
    adversarial: true,
    task: {
      id: 'memory-aware-agent-adversarial-ensemble-success-task',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
  }),
  new EvaluationCase({
    id: 'memory-aware-agent-adversarial-ensemble-weakness',
    domain: 'graph',
    adversarial: true,
    task: {
      id: 'memory-aware-agent-adversarial-ensemble-weakness-task',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: () => false
  })
];
const adversarialEnsemble = new AdversarialLineageEnsembleRunner({
  ensembleId: 'memory-aware-agent-adversarial-ensemble-history',
  maxLineages: 3
}).run({
  candidateId: 'memory-aware-agent-adversarial-ensemble-kernel',
  cases,
  lineageCount: 3
});
const ledger = new EvidenceLedger();
ledger.appendAdversarialLineageEnsemble(adversarialEnsemble);
const verifiedLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function createAgent(plannerId) {
  return memoryAwareAgentFromLedger({
    ledger: verifiedLedger,
    planner: new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphFromMemory',
        timeoutMs: 2000
      }),
      plannerId
    })
  });
}

const agents = [
  createAgent('memory-aware-agent-adversarial-ensemble-planner-1'),
  createAgent('memory-aware-agent-adversarial-ensemble-planner-2')
];
const report = new MemoryAwareAgentEnsembleRunner({
  maxAgents: 2,
  minimumProvenAgents: 2
}).run({
  agents,
  goal: 'graph',
  query: {
    source: MEMORY_SOURCES.ADVERSARIAL_LINEAGE,
    strategyKey: 'adversarial-lineage-ensemble',
    keywords: ['independent', 'weakness-exposed'],
    limit: 1
  },
  context: {
    taskId: 'memory-aware-agent-adversarial-ensemble-next-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-agent-adversarial-lineage-ensemble'
});

assert.equal(isTrustedMemoryAwareAgentEnsembleReport(report), true);
assert.equal(report.attemptedAgents, 2);
assert.equal(report.completedAgents, 2);
assert.equal(report.provenAgents, 2);
assert.equal(report.quorum, 2);
assert.equal(report.quorumMet, true);
assert.equal(report.allComplete, true);
assert.equal(report.allProven, true);
assert.equal(report.auditValid, true);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(agents[0] !== agents[1], true);
assert.equal(agents[0].planner !== agents[1].planner, true);
assert.equal(agents[0].runner !== agents[1].runner, true);
assert.equal(report.members.length, 2);
for (const member of report.members) {
  assert.equal(member.completed, true);
  assert.equal(member.proven, true);
  assert.equal(member.auditValid, true);
  assert.equal(member.memoryResultCount, 1);
  assert.deepEqual(member.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
  assert.equal(member.dataOnly, true);
  assert.equal(member.authorityTransferred, false);
  assert.equal(Object.hasOwn(member, 'agent'), false);
  assert.equal(Object.hasOwn(member, 'runReport'), false);
}
assert.equal(Object.hasOwn(report, 'agents'), false);
assert.equal(Object.hasOwn(report, 'runReports'), false);

const firstReceipt = agents[0].persistRun({ ledger: verifiedLedger });
const secondReceipt = agents[1].persistRun({ ledger: verifiedLedger });
assert.equal(isTrustedMemoryAwareAgentLedgerReceipt(firstReceipt), true);
assert.equal(isTrustedMemoryAwareAgentLedgerReceipt(secondReceipt), true);
assert.equal(verifiedLedger.length, 3);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ADVERSARIAL_LINEAGE_ENSEMBLE_OK `
  + `agents=${report.attemptedAgents} completed=${report.completedAgents} proven=${report.provenAgents} `
  + `quorum=${report.quorum} quorumMet=${report.quorumMet} memoryResults=${report.members[0].memoryResultCount} `
  + `independent=${agents[0].planner !== agents[1].planner && agents[0].runner !== agents[1].runner} `
  + `proof=${report.members[0].actionEvidence[0]} persisted=${verifiedLedger.length} `
  + `summaryOnly=${report.dataOnly} authorityTransferred=${report.authorityTransferred}`
);
