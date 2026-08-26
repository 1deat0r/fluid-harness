import assert from 'node:assert/strict';

import {
  DistributionShiftRunner,
  DISTRIBUTION_SHIFT_STATUSES,
  isTrustedDistributionShiftReport,
  isTrustedDistributionShiftRunner
} from '../src/distribution-shift.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const baselineCase = new EvaluationCase({
  id: 'distribution-shift-baseline',
  domain: 'graph',
  task: { id: 'distribution-shift-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report?.result?.found === true
    && report?.evidence === EVIDENCE_LEVELS.PROVEN
});

const stableShift = new EvaluationCase({
  id: 'distribution-shift-irrelevant-node',
  domain: 'graph',
  adversarial: true,
  task: { id: 'distribution-shift-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B', 'C'],
    edges: [['A', 'B'], ['C', 'C']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report?.result?.found === true
    && report?.evidence === EVIDENCE_LEVELS.PROVEN
});

const weaknessShift = new EvaluationCase({
  id: 'distribution-shift-missing-edge',
  domain: 'graph',
  adversarial: true,
  task: { id: 'distribution-shift-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report?.result?.found === true
    && report?.evidence === EVIDENCE_LEVELS.PROVEN
});

const runner = new DistributionShiftRunner({
  suiteId: 'distribution-shift-positive',
  maxShifts: 2
});
assert.equal(isTrustedDistributionShiftRunner(runner), true);
const report = runner.run({
  candidateId: 'distribution-shift-kernel',
  baselineCase,
  shiftCases: [stableShift, weaknessShift]
});

assert.equal(isTrustedDistributionShiftReport(report), true);
assert.equal(report.suiteId, 'distribution-shift-positive');
assert.equal(report.candidateId, 'distribution-shift-kernel');
assert.equal(report.taskId, 'distribution-shift-task');
assert.equal(report.domain, 'graph');
assert.equal(report.shiftCount, 2);
assert.equal(report.attemptedCases, 3);
assert.equal(report.baselineSuccess, true);
assert.equal(report.shiftSuccesses, 1);
assert.equal(report.weaknessesExposed, 1);
assert.equal(report.successes, 2);
assert.equal(report.successRate, 2 / 3);
assert.equal(report.shiftSuccessRate, 0.5);
assert.equal(report.status, DISTRIBUTION_SHIFT_STATUSES.WEAKNESS_EXPOSED);
assert.equal(report.robust, false);
assert.equal(report.requiresReview, true);
assert.equal(report.complete, true);
assert.equal(report.independent, true);
assert.equal(report.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(report.dataOnly, true);
assert.equal(report.historicalOnly, true);
assert.equal(report.productionEligible, false);
assert.equal(report.authorityTransferred, false);
assert.equal(report.baseline.role, 'baseline');
assert.equal(report.baseline.caseId, baselineCase.id);
assert.equal(report.shifts[0].role, 'shift');
assert.equal(report.shifts[0].caseId, stableShift.id);
assert.equal(report.shifts[0].success, true);
assert.equal(report.shifts[1].caseId, weaknessShift.id);
assert.equal(report.shifts[1].success, false);
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.baseline), true);
assert.equal(Object.isFrozen(report.shifts), true);
assert.equal(Object.isFrozen(report.shifts[0]), true);
assert.equal(Object.hasOwn(report, 'runner'), false);
assert.equal(Object.hasOwn(report, 'harness'), false);
assert.equal(Object.hasOwn(report, 'actionReport'), false);
assert.equal(Object.hasOwn(report, 'promotionAuthority'), false);

console.log(
  `FLUID_DISTRIBUTION_SHIFT_OK suite=${report.suiteId} cases=${report.attemptedCases} `
  + `shifts=${report.shiftCount} baseline=${report.baselineSuccess} `
  + `shiftSuccesses=${report.shiftSuccesses} weaknesses=${report.weaknessesExposed} `
  + `status=${report.status} independent=${report.independent} `
  + `summaryOnly=${report.dataOnly && report.historicalOnly} `
  + `authorityTransferred=${report.authorityTransferred}`
);
