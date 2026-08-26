import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AdversarialLineageEnsembleRunner } from '../src/adversarial-lineage-ensemble.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { memoryAwareAgentFromLedger } from '../src/memory-agent.mjs';
import {
  MemoryAwareAgentEnsembleRunner,
  isTrustedMemoryAwareAgentEnsembleReport
} from '../src/memory-agent-ensemble.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const cases = [
  new EvaluationCase({
    id: 'memory-aware-agent-adversarial-ensemble-boundary-success',
    domain: 'graph',
    adversarial: true,
    task: {
      id: 'memory-aware-agent-adversarial-ensemble-boundary-success-task',
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
    id: 'memory-aware-agent-adversarial-ensemble-boundary-weakness',
    domain: 'graph',
    adversarial: true,
    task: {
      id: 'memory-aware-agent-adversarial-ensemble-boundary-weakness-task',
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

function buildLedger() {
  const ensemble = new AdversarialLineageEnsembleRunner({
    ensembleId: 'memory-aware-agent-adversarial-ensemble-boundary-history',
    maxLineages: 2
  }).run({
    candidateId: 'memory-aware-agent-adversarial-ensemble-boundary-kernel',
    cases,
    lineageCount: 2
  });
  const ledger = new EvidenceLedger();
  ledger.appendAdversarialLineageEnsemble(ensemble);
  return ledger;
}

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
function createAgent(ledger, plannerId) {
  return memoryAwareAgentFromLedger({
    ledger,
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

const ledger = buildLedger();
assert.throws(
  () => createAgent({}, 'memory-aware-agent-adversarial-ensemble-forged-ledger'),
  /trusted evidence ledger/
);
const tampered = JSON.parse(ledger.serialize());
tampered.records[0].payload.lineages[0].successes = 0;
assert.throws(
  () => createAgent(
    EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
    'memory-aware-agent-adversarial-ensemble-tampered-ledger'
  ),
  /inconsistent|hash verification failed/
);

const agents = [
  createAgent(ledger, 'memory-aware-agent-adversarial-ensemble-boundary-planner-1'),
  createAgent(ledger, 'memory-aware-agent-adversarial-ensemble-boundary-planner-2')
];
const runner = new MemoryAwareAgentEnsembleRunner({
  maxAgents: 2,
  minimumProvenAgents: 2
});
assert.throws(
  () => runner.run({ agents: [agents[0], agents[0]], goal: 'graph' }),
  /distinct/
);
assert.throws(
  () => runner.run({ agents: [{}, agents[1]], goal: 'graph' }),
  /trusted/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'keywords', {
  enumerable: true,
  get() {
    return ['independent'];
  }
});
assert.throws(
  () => runner.run({ agents, goal: 'graph', query: accessorQuery }),
  /data properties|snapshot/
);
const cyclicContext = {};
cyclicContext.self = cyclicContext;
assert.throws(
  () => runner.run({ agents, goal: 'graph', context: cyclicContext }),
  /cycle|cyclic|snapshot/i
);

const strategyMismatch = runner.run({
  agents,
  goal: 'graph',
  query: {
    source: MEMORY_SOURCES.ADVERSARIAL_LINEAGE,
    strategyKey: 'adversarial-lineage'
  },
  context: {
    taskId: 'memory-aware-agent-adversarial-ensemble-strategy-mismatch',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-agent-adversarial-ensemble-strategy-mismatch'
});
assert.equal(isTrustedMemoryAwareAgentEnsembleReport(strategyMismatch), true);
assert.equal(strategyMismatch.quorumMet, true);
assert.equal(strategyMismatch.allProven, true);
assert.equal(strategyMismatch.members[0].memoryResultCount, 0);
assert.deepEqual(strategyMismatch.members[0].actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
assert.equal(strategyMismatch.authorityTransferred, false);
assert.equal(Object.hasOwn(strategyMismatch, 'agents'), false);
assert.equal(Object.hasOwn(strategyMismatch.members[0], 'runReport'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_ADVERSARIAL_LINEAGE_ENSEMBLE_BOUNDARY_OK `
  + `forgedLedgerRejected=true tamperedLedgerRejected=true duplicateRejected=true `
  + `untrustedRejected=true accessorRejected=true cyclicRejected=true `
  + `strategyMismatch=${strategyMismatch.members[0].memoryResultCount} freshProof=${strategyMismatch.members[0].actionEvidence[0]} `
  + `artifactExposureRejected=true quorum=${strategyMismatch.quorumMet} authoritySuppressed=true`
);
