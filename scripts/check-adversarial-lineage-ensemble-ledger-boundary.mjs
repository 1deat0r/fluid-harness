import assert from 'node:assert/strict';

import {
  AdversarialLineageEnsembleReport,
  AdversarialLineageEnsembleRunner
} from '../src/adversarial-lineage-ensemble.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationBudget, EvaluationCase, PromotionAuthority } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

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

const cases = [
  lineageCase('adversarial-lineage-ensemble-ledger-boundary-success'),
  lineageCase('adversarial-lineage-ensemble-ledger-boundary-weakness', false)
];
const ensemble = new AdversarialLineageEnsembleRunner({
  ensembleId: 'adversarial-lineage-ensemble-ledger-boundary',
  maxLineages: 2
}).run({
  candidateId: 'ensemble-ledger-boundary-kernel',
  cases,
  lineageCount: 2
});
const ledger = new EvidenceLedger();
ledger.appendAdversarialLineageEnsemble(ensemble);
const serialized = ledger.serialize();

assert.throws(
  () => ledger.appendAdversarialLineageEnsemble(Object.freeze({ ...ensemble })),
  /trusted ensemble report/
);
assert.throws(
  () => new AdversarialLineageEnsembleReport({
    ensembleId: 'forged-ensemble',
    candidateId: 'forged-candidate',
    lineages: [],
    token: {}
  }),
  /trusted runner path/
);
assert.throws(
  () => new PromotionAuthority().decide(ensemble),
  /report produced by EvaluationRunner/
);

const tamperedMetrics = JSON.parse(serialized);
tamperedMetrics.records[0].payload.weaknessesExposed = 0;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedMetrics)),
  /inconsistent|hash verification failed/
);

const tamperedNestedMetrics = JSON.parse(serialized);
tamperedNestedMetrics.records[0].payload.lineages[0].successes = 0;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedNestedMetrics)),
  /inconsistent|hash verification failed/
);

const tamperedBoundary = JSON.parse(serialized);
tamperedBoundary.records[0].payload.independent = false;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedBoundary)),
  /proof boundary is invalid|hash verification failed/
);

const tamperedArtifact = JSON.parse(serialized);
tamperedArtifact.records[0].payload.lineages[0].results[0].actionReport = {};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedArtifact)),
  /invalid shape|hash verification failed/
);

const tamperedDuplicate = JSON.parse(serialized);
tamperedDuplicate.records[0].payload.lineages[1].lineageId =
  tamperedDuplicate.records[0].payload.lineages[0].lineageId;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedDuplicate)),
  /duplicated|hash verification failed/
);

const incomplete = new AdversarialLineageEnsembleRunner({
  ensembleId: 'adversarial-lineage-ensemble-ledger-incomplete',
  maxLineages: 2
}).run({
  candidateId: 'ensemble-ledger-incomplete-kernel',
  cases: [
    lineageCase('adversarial-lineage-ensemble-incomplete-one'),
    lineageCase('adversarial-lineage-ensemble-incomplete-two', false)
  ],
  budget: new EvaluationBudget({ maxCases: 1 }),
  lineageCount: 2
});
assert.equal(incomplete.complete, false);
assert.equal(incomplete.skippedCases, 1);
const incompleteLedger = new EvidenceLedger();
incompleteLedger.appendAdversarialLineageEnsemble(incomplete);
const restoredIncomplete = EvidenceLedger.fromSerialized(incompleteLedger.serialize())
  .restoreAdversarialLineageEnsembles()[0];
assert.equal(restoredIncomplete.complete, false);
assert.equal(restoredIncomplete.skippedCases, 1);
assert.equal(restoredIncomplete.evaluatedCases, 2);
assert.equal(restoredIncomplete.eligibleEvaluations, 4);
assert.equal(restoredIncomplete.dataOnly, true);
assert.equal(restoredIncomplete.authorityTransferred, false);

console.log(
  `FLUID_ADVERSARIAL_LINEAGE_ENSEMBLE_LEDGER_BOUNDARY_OK forgedReportRejected=true `
  + `forgedConstructorRejected=true promotionRejected=true tamperedMetricsRejected=true `
  + `nestedTamperRejected=true proofBoundaryRejected=true artifactRejected=true `
  + `duplicateRejected=true incompletePreserved=true frozen=true dataOnly=true `
  + `historicalOnly=true authoritySuppressed=true`
);
