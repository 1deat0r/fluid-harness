import assert from 'node:assert/strict';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { AdversarialLineageRunner } from '../src/adversarial-lineage.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';

const cases = [
  new EvaluationCase({
    id: 'structured-memory-adversarial-success',
    domain: 'graph',
    adversarial: true,
    task: { id: 'structured-memory-adversarial-success-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
  }),
  new EvaluationCase({
    id: 'structured-memory-adversarial-weakness',
    domain: 'graph',
    adversarial: true,
    task: { id: 'structured-memory-adversarial-weakness-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: () => false
  })
];
const lineage = new AdversarialLineageRunner({
  lineageId: 'structured-memory-adversarial-lineage'
}).run({
  candidateId: 'structured-memory-adversarial-kernel',
  cases
});
const ledger = new EvidenceLedger();
ledger.appendAgentRun(new BoundedAgentRunner().run({
  episodes: [{
    task: {
      id: 'structured-memory-adversarial-agent-run',
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
const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const memory = memoryFromLedger({
  ledger: restoredLedger,
  idPrefix: 'structured-memory-adversarial'
});

const adversarial = memory.query({
  source: MEMORY_SOURCES.ADVERSARIAL_LINEAGE,
  strategyKey: 'adversarial-lineage',
  keywords: ['weakness-exposed'],
  limit: 2
});
const agentRuns = memory.query({ source: MEMORY_SOURCES.LEDGER });
assert.equal(memory.size, 2);
assert.equal(adversarial.totalMatches, 1);
assert.equal(adversarial.returnedCount, 1);
assert.equal(adversarial.results[0].source, MEMORY_SOURCES.ADVERSARIAL_LINEAGE);
assert.equal(adversarial.results[0].evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(adversarial.results[0].architectureId, lineage.candidateId);
assert.equal(adversarial.results[0].historicalOnly, true);
assert.equal(adversarial.results[0].dataOnly, true);
assert.equal(adversarial.results[0].provenance.kind, 'adversarial-lineage');
assert.equal(Object.isFrozen(adversarial.results[0].provenance), true);
assert.equal(Object.hasOwn(adversarial.results[0], 'results'), false);
assert.equal(Object.hasOwn(adversarial.results[0], 'runner'), false);
assert.equal(Object.hasOwn(adversarial.results[0], 'harness'), false);
assert.equal(Object.hasOwn(adversarial.results[0], 'actionReport'), false);
assert.equal(agentRuns.totalMatches, 1);

console.log(
  `FLUID_STRUCTURED_MEMORY_ADVERSARIAL_LINEAGE_OK entries=${memory.size} `
  + `lineages=${adversarial.totalMatches} source=${adversarial.results[0].source} `
  + `weaknesses=${lineage.weaknessesExposed} evidence=${adversarial.results[0].evidence} `
  + `provenance=${adversarial.results[0].provenance.kind} historicalOnly=true `
  + `authoritySuppressed=true agentRuns=${agentRuns.totalMatches}`
);
