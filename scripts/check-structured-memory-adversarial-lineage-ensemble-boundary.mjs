import assert from 'node:assert/strict';

import { AdversarialLineageEnsembleRunner } from '../src/adversarial-lineage-ensemble.mjs';
import { BoundedAgentRunner } from '../src/agent.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';

const evaluationCase = new EvaluationCase({
  id: 'structured-memory-adversarial-ensemble-boundary-case',
  domain: 'graph',
  adversarial: true,
  task: {
    id: 'structured-memory-adversarial-ensemble-boundary-task',
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
});
const ensemble = new AdversarialLineageEnsembleRunner({
  ensembleId: 'structured-memory-adversarial-ensemble-boundary',
  maxLineages: 2
}).run({
  candidateId: 'structured-memory-adversarial-ensemble-boundary-kernel',
  cases: [evaluationCase],
  lineageCount: 2
});
const ledger = new EvidenceLedger();
ledger.appendAgentRun(new BoundedAgentRunner().run({
  episodes: [{
    task: {
      id: 'structured-memory-adversarial-ensemble-boundary-agent-run',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }]
}));
ledger.appendAdversarialLineageEnsemble(ensemble);
const serialized = ledger.serialize();
const memory = memoryFromLedger({ ledger });
const result = memory.query({ source: MEMORY_SOURCES.ADVERSARIAL_LINEAGE });

assert.equal(result.totalMatches, 1);
assert.equal(result.results[0].dataOnly, true);
assert.equal(result.results[0].historicalOnly, true);
assert.equal(Object.hasOwn(result.results[0], 'lineages'), false);
assert.equal(Object.hasOwn(result.results[0], 'authorityTransferred'), false);
assert.equal(
  memory.query({ source: MEMORY_SOURCES.SESSION }).totalMatches,
  0
);
assert.throws(
  () => memory.query({ source: 'FORGED' }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.ADVERSARIAL_LINEAGE;
  }
});
assert.throws(
  () => memory.query(accessorQuery),
  /only enumerable data properties/
);
assert.throws(
  () => memoryFromLedger({ ledger, maxEntries: 1 }),
  /exceeds remaining capacity/
);

const tampered = JSON.parse(serialized);
tampered.records[tampered.records.length - 1].payload.successes = 0;
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered))
  }),
  /inconsistent|hash verification failed/
);
const tamperedArtifact = JSON.parse(serialized);
tamperedArtifact.records[tamperedArtifact.records.length - 1]
  .payload.lineages[0].results[0].actionReport = {};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedArtifact)),
  /invalid shape|hash verification failed/
);

console.log(
  `FLUID_STRUCTURED_MEMORY_ADVERSARIAL_LINEAGE_ENSEMBLE_BOUNDARY_OK `
  + `forgedSourceRejected=true accessorRejected=true sourceMismatch=0 `
  + `capacityRejected=true tamperedRejected=true artifactRejected=true `
  + `source=${result.results[0].source} dataOnly=${result.results[0].dataOnly} `
  + `historicalOnly=${result.results[0].historicalOnly} authoritySuppressed=true`
);
