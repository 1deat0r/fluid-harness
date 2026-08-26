import assert from 'node:assert/strict';

import { AdversarialLineageRunner } from '../src/adversarial-lineage.mjs';
import { BoundedAgentRunner } from '../src/agent.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';
import {
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';

function lineageCase(id, expected) {
  return new EvaluationCase({
    id,
    domain: 'graph',
    adversarial: true,
    task: { id: `${id}-task`, description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => expected && report?.evidence === 'PROVEN'
  });
}

const lineage = new AdversarialLineageRunner({
  lineageId: 'structured-memory-adversarial-boundary-lineage'
}).run({
  candidateId: 'structured-memory-adversarial-boundary-kernel',
  cases: [
    lineageCase('structured-memory-adversarial-boundary-success', true),
    lineageCase('structured-memory-adversarial-boundary-weakness', false)
  ]
});
const ledger = new EvidenceLedger();
ledger.appendAgentRun(new BoundedAgentRunner().run({
  episodes: [{
    task: {
      id: 'structured-memory-adversarial-boundary-agent-run',
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
ledger.appendAdversarialLineage(lineage);
const serialized = ledger.serialize();
const memory = memoryFromLedger({ ledger });
const adversarial = memory.query({ source: MEMORY_SOURCES.ADVERSARIAL_LINEAGE });

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
assert.equal(
  memory.query({ source: MEMORY_SOURCES.COORDINATION }).totalMatches,
  0
);
assert.equal(adversarial.totalMatches, 1);
assert.equal(adversarial.results[0].evidence, 'OBSERVED');
assert.equal(adversarial.results[0].historicalOnly, true);
assert.equal(adversarial.results[0].dataOnly, true);
assert.equal(Object.hasOwn(adversarial.results[0], 'results'), false);
assert.equal(Object.hasOwn(adversarial.results[0], 'authorityTransferred'), false);

assert.throws(
  () => memoryFromLedger({ ledger, maxEntries: 1 }),
  /exceeds remaining capacity/
);

const tampered = JSON.parse(serialized);
tampered.records[tampered.records.length - 1].payload.weaknessesExposed = 0;
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered))
  }),
  /inconsistent|hash verification failed/
);

const artifactTampered = JSON.parse(serialized);
artifactTampered.records[artifactTampered.records.length - 1]
  .payload.results[0].actionReport = {};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(artifactTampered)),
  /invalid shape|hash verification failed/
);

console.log(
  `FLUID_STRUCTURED_MEMORY_ADVERSARIAL_LINEAGE_BOUNDARY_OK forgedSourceRejected=true `
  + `accessorRejected=true sourceMismatch=0 capacityRejected=true tamperedRejected=true `
  + `artifactRejected=true source=${adversarial.results[0].source} `
  + `dataOnly=${adversarial.results[0].dataOnly} historicalOnly=${adversarial.results[0].historicalOnly} `
  + `authoritySuppressed=true`
);
