import assert from 'node:assert/strict';

import {
  AdversarialLineageEnsembleRunner,
  isTrustedAdversarialLineageEnsembleReport
} from '../src/adversarial-lineage-ensemble.mjs';
import { isTrustedAdversarialLineageReport } from '../src/adversarial-lineage.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const cases = [
  new EvaluationCase({
    id: 'adversarial-lineage-ensemble-ledger-success',
    domain: 'graph',
    adversarial: true,
    task: { id: 'adversarial-lineage-ensemble-ledger-success-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
  }),
  new EvaluationCase({
    id: 'adversarial-lineage-ensemble-ledger-weakness',
    domain: 'graph',
    adversarial: true,
    task: { id: 'adversarial-lineage-ensemble-ledger-weakness-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: () => false
  })
];
const ensemble = new AdversarialLineageEnsembleRunner({
  ensembleId: 'adversarial-lineage-ensemble-ledger',
  maxLineages: 3
}).run({
  candidateId: 'ensemble-ledger-kernel',
  cases,
  lineageCount: 3
});
const ledger = new EvidenceLedger();
const record = ledger.appendAdversarialLineageEnsemble(ensemble);
const serialized = ledger.serialize();
const restored = EvidenceLedger.fromSerialized(serialized);
const ensembles = restored.restoreAdversarialLineageEnsembles();
const restoredEnsemble = ensembles[0];

assert.equal(isTrustedAdversarialLineageEnsembleReport(ensemble), true);
assert.equal(ledger.verify(), true);
assert.equal(record.kind, 'adversarial-lineage-ensemble');
assert.equal(record.payload.lineageCount, 3);
assert.equal(record.payload.evaluatedCases, 6);
assert.equal(record.payload.weaknessesExposed, 3);
assert.equal(record.payload.independent, true);
assert.equal(record.payload.productionEligible, false);
assert.equal(record.payload.authorityTransferred, false);
assert.equal(Object.isFrozen(record), true);
assert.equal(Object.isFrozen(record.payload), true);
assert.equal(Object.hasOwn(record.payload, 'runner'), false);
assert.equal(Object.hasOwn(record.payload, 'harness'), false);
assert.equal(Object.hasOwn(record.payload, 'actionReport'), false);
assert.equal(restored.verify(), true);
assert.equal(restored.serialize(), serialized);
assert.equal(ensembles.length, 1);
assert.equal(isTrustedAdversarialLineageEnsembleReport(restoredEnsemble), false);
assert.equal(Object.isFrozen(ensembles), true);
assert.equal(Object.isFrozen(restoredEnsemble), true);
assert.equal(Object.isFrozen(restoredEnsemble.lineages), true);
assert.equal(Object.isFrozen(restoredEnsemble.lineages[0]), true);
assert.equal(Object.isFrozen(restoredEnsemble.lineages[0].results), true);
assert.equal(restoredEnsemble.ensembleId, ensemble.ensembleId);
assert.equal(restoredEnsemble.candidateId, ensemble.candidateId);
assert.equal(restoredEnsemble.lineageCount, ensemble.lineageCount);
assert.equal(restoredEnsemble.evaluatedCases, ensemble.evaluatedCases);
assert.equal(restoredEnsemble.successes, ensemble.successes);
assert.equal(restoredEnsemble.weaknessesExposed, ensemble.weaknessesExposed);
assert.equal(restoredEnsemble.complete, true);
assert.equal(restoredEnsemble.dataOnly, true);
assert.equal(restoredEnsemble.historicalOnly, true);
assert.equal(restoredEnsemble.productionEligible, false);
assert.equal(restoredEnsemble.authorityTransferred, false);
assert.equal(isTrustedAdversarialLineageReport(restoredEnsemble.lineages[0]), false);
assert.equal(Object.hasOwn(restoredEnsemble, 'runner'), false);
assert.equal(Object.hasOwn(restoredEnsemble, 'harness'), false);
assert.equal(Object.hasOwn(restoredEnsemble, 'actionReport'), false);

console.log(
  `FLUID_ADVERSARIAL_LINEAGE_ENSEMBLE_LEDGER_OK kind=${record.kind} `
  + `ensembles=${ensembles.length} lineages=${restoredEnsemble.lineageCount} `
  + `cases=${restoredEnsemble.evaluatedCases}/${restoredEnsemble.eligibleEvaluations} `
  + `weaknesses=${restoredEnsemble.weaknessesExposed} restoredTrusted=false frozen=true `
  + `dataOnly=${restoredEnsemble.dataOnly} historicalOnly=${restoredEnsemble.historicalOnly} `
  + `authoritySuppressed=true`
);
