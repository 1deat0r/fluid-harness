import assert from 'node:assert/strict';

import {
  AdversarialLineageEnsembleRunner,
  isTrustedAdversarialLineageEnsembleReport
} from '../src/adversarial-lineage-ensemble.mjs';
import { isTrustedAdversarialLineageReport } from '../src/adversarial-lineage.mjs';
import { EvaluationCase, PromotionAuthority } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const cases = [
  new EvaluationCase({
    id: 'adversarial-lineage-ensemble-success',
    domain: 'graph',
    adversarial: true,
    task: { id: 'adversarial-lineage-ensemble-success-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
  }),
  new EvaluationCase({
    id: 'adversarial-lineage-ensemble-weakness',
    domain: 'graph',
    adversarial: true,
    task: { id: 'adversarial-lineage-ensemble-weakness-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: () => false
  })
];
const report = new AdversarialLineageEnsembleRunner({
  ensembleId: 'adversarial-lineage-ensemble-positive',
  maxLineages: 3
}).run({
  candidateId: 'ensemble-kernel',
  cases,
  lineageCount: 3
});

assert.equal(isTrustedAdversarialLineageEnsembleReport(report), true);
assert.equal(report.lineageCount, 3);
assert.equal(report.lineages.length, 3);
assert.equal(report.eligibleCases, 2);
assert.equal(report.attemptedCases, 2);
assert.equal(report.evaluatedCases, 6);
assert.equal(report.eligibleEvaluations, 6);
assert.equal(report.successes, 3);
assert.equal(report.weaknessesExposed, 3);
assert.equal(report.successRate, 0.5);
assert.equal(report.adversarialSuccessRate, 0.5);
assert.equal(report.complete, true);
assert.equal(report.independent, true);
assert.equal(report.dataOnly, true);
assert.equal(report.historicalOnly, true);
assert.equal(report.productionEligible, false);
assert.equal(report.authorityTransferred, false);
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.lineages), true);
assert.equal(Object.isFrozen(report.lineages[0]), true);
assert.equal(Object.isFrozen(report.lineages[0].results), true);
assert.equal(isTrustedAdversarialLineageReport(report.lineages[0]), false);
assert.equal(Object.hasOwn(report, 'runner'), false);
assert.equal(Object.hasOwn(report, 'harness'), false);
assert.equal(Object.hasOwn(report, 'actionReport'), false);
assert.throws(
  () => new PromotionAuthority().decide(report),
  /report produced by EvaluationRunner/
);

console.log(
  `FLUID_ADVERSARIAL_LINEAGE_ENSEMBLE_OK lineages=${report.lineageCount} `
  + `cases=${report.evaluatedCases}/${report.eligibleEvaluations} successes=${report.successes} `
  + `weaknesses=${report.weaknessesExposed} independent=${report.independent} `
  + `complete=${report.complete} summaryOnly=${report.dataOnly && report.historicalOnly} `
  + `productionEligible=${report.productionEligible} authorityTransferred=${report.authorityTransferred}`
);
