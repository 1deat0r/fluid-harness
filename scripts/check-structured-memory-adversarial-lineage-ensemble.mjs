import assert from 'node:assert/strict';

import { AdversarialLineageEnsembleRunner } from '../src/adversarial-lineage-ensemble.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';

function lineageCase(id, expected = true) {
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
    expected: (report) => expected && report?.evidence === EVIDENCE_LEVELS.PROVEN
  });
}

const ensemble = new AdversarialLineageEnsembleRunner({
  ensembleId: 'structured-memory-adversarial-ensemble',
  maxLineages: 3
}).run({
  candidateId: 'structured-memory-adversarial-ensemble-kernel',
  cases: [
    lineageCase('structured-memory-adversarial-ensemble-success'),
    lineageCase('structured-memory-adversarial-ensemble-weakness', false)
  ],
  lineageCount: 3
});
const ledger = new EvidenceLedger();
ledger.appendAdversarialLineageEnsemble(ensemble);
const memory = memoryFromLedger({
  ledger: EvidenceLedger.fromSerialized(ledger.serialize()),
  idPrefix: 'structured-memory-adversarial-ensemble'
});
const result = memory.query({
  source: MEMORY_SOURCES.ADVERSARIAL_LINEAGE,
  strategyKey: 'adversarial-lineage-ensemble',
  keywords: ['independent'],
  limit: 2
});
const singleLineages = memory.query({
  source: MEMORY_SOURCES.ADVERSARIAL_LINEAGE,
  strategyKey: 'adversarial-lineage'
});

assert.equal(memory.size, 1);
assert.equal(result.totalMatches, 1);
assert.equal(result.results[0].source, MEMORY_SOURCES.ADVERSARIAL_LINEAGE);
assert.equal(result.results[0].architectureId, ensemble.candidateId);
assert.equal(result.results[0].evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(result.results[0].keywords.includes('lineages-3'), true);
assert.equal(result.results[0].keywords.includes('cases-6'), true);
assert.equal(result.results[0].keywords.includes('weaknesses-3'), true);
assert.equal(result.results[0].provenance.kind, 'adversarial-lineage-ensemble');
assert.equal(Object.isFrozen(result.results[0].provenance), true);
assert.equal(result.results[0].dataOnly, true);
assert.equal(result.results[0].historicalOnly, true);
assert.equal(Object.hasOwn(result.results[0], 'lineages'), false);
assert.equal(Object.hasOwn(result.results[0], 'runner'), false);
assert.equal(Object.hasOwn(result.results[0], 'actionReport'), false);
assert.equal(singleLineages.totalMatches, 0);

console.log(
  `FLUID_STRUCTURED_MEMORY_ADVERSARIAL_LINEAGE_ENSEMBLE_OK entries=${memory.size} `
  + `ensembles=${result.totalMatches} source=${result.results[0].source} `
  + `lineages=${ensemble.lineageCount} cases=${ensemble.evaluatedCases} `
  + `weaknesses=${ensemble.weaknessesExposed} evidence=${result.results[0].evidence} `
  + `provenance=${result.results[0].provenance.kind} historicalOnly=true `
  + `authoritySuppressed=true`
);
