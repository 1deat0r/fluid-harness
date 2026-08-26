import assert from 'node:assert/strict';

import {
  AdversarialLineageReport,
  AdversarialLineageRunner,
  isTrustedAdversarialLineageReport
} from '../src/adversarial-lineage.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  EvaluationBudget,
  EvaluationCase,
  PromotionAuthority
} from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

function adversarialCase(id, expected = true, connected = true) {
  return new EvaluationCase({
    id,
    domain: 'graph',
    adversarial: true,
    task: { id: `${id}-task`, description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: connected ? [['A', 'B']] : [],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => expected
      && report?.evidence === EVIDENCE_LEVELS.PROVEN
  });
}

const cases = [
  adversarialCase('adversarial-lineage-ledger-boundary-success'),
  adversarialCase('adversarial-lineage-ledger-boundary-weakness', false, false)
];
const report = new AdversarialLineageRunner({
  lineageId: 'adversarial-lineage-ledger-boundary'
}).run({
  candidateId: 'boundary-ledger-kernel',
  cases
});
const ledger = new EvidenceLedger();
ledger.appendAdversarialLineage(report);
const serialized = ledger.serialize();

assert.equal(isTrustedAdversarialLineageReport(report), true);
assert.throws(
  () => ledger.appendAdversarialLineage(Object.freeze({ ...report })),
  /trusted lineage report/
);
assert.throws(
  () => new AdversarialLineageReport({
    lineageId: 'forged-lineage',
    candidateId: 'forged-candidate',
    summary: {
      results: [],
      eligibleCases: 0,
      attemptedCases: 0,
      skippedCases: 0,
      successes: 0,
      proofEligibleCases: 0,
      proven: 0,
      adversarialCases: 0,
      adversarialSuccesses: 0,
      weaknessesExposed: 0,
      complete: true
    }
  }),
  /trusted runner path/
);
assert.throws(
  () => new PromotionAuthority().decide(report),
  /report produced by EvaluationRunner/
);

const tamperedMetrics = JSON.parse(serialized);
tamperedMetrics.records[0].payload.weaknessesExposed = 0;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedMetrics)),
  /inconsistent|hash verification failed/
);

const tamperedBoundary = JSON.parse(serialized);
tamperedBoundary.records[0].payload.dataOnly = false;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedBoundary)),
  /proof boundary is invalid|hash verification failed/
);

const tamperedArtifact = JSON.parse(serialized);
tamperedArtifact.records[0].payload.results[0].actionReport = {};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedArtifact)),
  /invalid shape|hash verification failed/
);

const tamperedMode = JSON.parse(serialized);
tamperedMode.records[0].payload.mode = 'production';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedMode)),
  /mode is invalid|hash verification failed/
);

const incompleteReport = new AdversarialLineageRunner({
  lineageId: 'adversarial-lineage-ledger-incomplete'
}).run({
  candidateId: 'incomplete-ledger-kernel',
  cases: [
    adversarialCase('adversarial-lineage-ledger-incomplete-one'),
    adversarialCase('adversarial-lineage-ledger-incomplete-two', false)
  ],
  budget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(incompleteReport.complete, false);
assert.equal(incompleteReport.skippedCases, 1);
const incompleteLedger = new EvidenceLedger();
incompleteLedger.appendAdversarialLineage(incompleteReport);
const restoredIncomplete = EvidenceLedger.fromSerialized(incompleteLedger.serialize())
  .restoreAdversarialLineages()[0];
assert.equal(restoredIncomplete.complete, false);
assert.equal(restoredIncomplete.attemptedCases, 1);
assert.equal(restoredIncomplete.eligibleCases, 2);
assert.equal(restoredIncomplete.skippedCases, 1);
assert.equal(restoredIncomplete.weaknessesExposed, incompleteReport.weaknessesExposed);

const restored = EvidenceLedger.fromSerialized(serialized);
const restoredLineage = restored.restoreAdversarialLineages()[0];
assert.equal(restored.verify(), true);
assert.equal(restoredLineage.dataOnly, true);
assert.equal(restoredLineage.historicalOnly, true);
assert.equal(restoredLineage.productionEligible, false);
assert.equal(restoredLineage.authorityTransferred, false);
assert.equal(isTrustedAdversarialLineageReport(restoredLineage), false);
assert.equal(Object.isFrozen(restoredLineage), true);
assert.equal(Object.isFrozen(restoredLineage.results), true);
assert.equal(Object.hasOwn(restoredLineage, 'runner'), false);
assert.equal(Object.hasOwn(restoredLineage, 'harness'), false);
assert.equal(Object.hasOwn(restoredLineage, 'actionReport'), false);
assert.equal(Object.hasOwn(restoredLineage, 'promotionAuthority'), false);

console.log(
  `FLUID_ADVERSARIAL_LINEAGE_LEDGER_BOUNDARY_OK forgedReportRejected=true `
  + `forgedConstructorRejected=true tamperedMetricsRejected=true `
  + `proofBoundaryRejected=true artifactRejected=true modeRejected=true `
  + `incompletePreserved=true frozen=true dataOnly=${restoredLineage.dataOnly} `
  + `historicalOnly=${restoredLineage.historicalOnly} authoritySuppressed=true`
);
