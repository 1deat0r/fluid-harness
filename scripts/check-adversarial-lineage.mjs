import assert from 'node:assert/strict';

import {
  AdversarialLineageRunner,
  isTrustedAdversarialLineageReport
} from '../src/adversarial-lineage.mjs';
import {
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES,
  PromotionAuthority,
  isTrustedEvaluationRunner
} from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';

let createdRunner = null;
const lineage = new AdversarialLineageRunner({
  lineageId: 'skeptic-lineage-positive',
  runnerFactory: () => {
    createdRunner = new EvaluationRunner({ harness: new FluidHarness() });
    return createdRunner;
  }
});
const cases = [
  new EvaluationCase({
    id: 'adversarial-lineage-success',
    domain: 'graph',
    adversarial: true,
    task: { id: 'adversarial-lineage-success-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
  }),
  new EvaluationCase({
    id: 'adversarial-lineage-weakness',
    domain: 'graph',
    adversarial: true,
    task: { id: 'adversarial-lineage-weakness-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [],
      start: 'A',
      goal: 'B'
    },
    expected: () => false
  })
];
const report = lineage.run({
  candidateId: 'default-kernel',
  cases
});

assert.equal(isTrustedAdversarialLineageReport(report), true);
assert.equal(isTrustedEvaluationRunner(createdRunner), true);
assert.equal(report.lineageId, 'skeptic-lineage-positive');
assert.equal(report.lineageType, 'skeptic');
assert.equal(report.mode, POLICY_MODES.SKEPTIC);
assert.equal(report.eligibleCases, 2);
assert.equal(report.attemptedCases, 2);
assert.equal(report.skippedCases, 0);
assert.equal(report.complete, true);
assert.equal(report.adversarialCases, 2);
assert.equal(report.adversarialSuccesses, 1);
assert.equal(report.weaknessesExposed, 1);
assert.equal(report.successRate, 0.5);
assert.equal(report.adversarialSuccessRate, 0.5);
assert.equal(report.dataOnly, true);
assert.equal(report.historicalOnly, true);
assert.equal(report.productionEligible, false);
assert.equal(report.authorityTransferred, false);
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.results), true);
assert.equal(Object.hasOwn(report, 'runner'), false);
assert.equal(Object.hasOwn(report, 'harness'), false);
assert.equal(Object.hasOwn(report, 'actionReport'), false);
report.results.forEach((result) => {
  assert.equal(result.adversarial, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.hasOwn(result, 'actionReport'), false);
  assert.equal(Object.hasOwn(result, 'runner'), false);
});
assert.throws(
  () => new PromotionAuthority().decide(report),
  /report produced by EvaluationRunner/
);

console.log(
  `FLUID_ADVERSARIAL_LINEAGE_OK lineage=${report.lineageId} mode=${report.mode} `
  + `cases=${report.attemptedCases}/${report.eligibleCases} successes=${report.adversarialSuccesses} `
  + `weaknesses=${report.weaknessesExposed} freshRunner=${createdRunner !== null} `
  + `summaryOnly=true dataOnly=${report.dataOnly} historicalOnly=${report.historicalOnly} `
  + `productionEligible=${report.productionEligible} authorityTransferred=${report.authorityTransferred}`
);
