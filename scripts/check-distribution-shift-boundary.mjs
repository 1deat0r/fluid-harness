import assert from 'node:assert/strict';

import {
  DistributionShiftReport,
  DistributionShiftRunner
} from '../src/distribution-shift.mjs';
import { EvaluationCase, EvaluationRunner } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

function graphCase({
  id,
  taskId = 'distribution-shift-boundary-task',
  description = 'Find a graph path',
  input,
  adversarial = false,
  requiresProof = true,
  expected = (report) => report?.result?.found === true
    && report?.evidence === EVIDENCE_LEVELS.PROVEN
}) {
  return new EvaluationCase({
    id,
    domain: 'graph',
    task: { id: taskId, description },
    input,
    adversarial,
    requiresProof,
    expected
  });
}

const baseInput = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const baseline = graphCase({
  id: 'distribution-shift-boundary-baseline',
  input: baseInput
});
const validShift = graphCase({
  id: 'distribution-shift-boundary-valid-shift',
  input: {
    nodes: ['A', 'B', 'C'],
    edges: [['A', 'B'], ['C', 'C']],
    start: 'A',
    goal: 'B'
  },
  adversarial: true
});
const weaknessShift = graphCase({
  id: 'distribution-shift-boundary-weakness-shift',
  input: {
    nodes: ['A', 'B'],
    edges: [],
    start: 'A',
    goal: 'B'
  },
  adversarial: true
});
const ordinaryShift = graphCase({
  id: 'distribution-shift-boundary-ordinary-shift',
  input: {
    nodes: ['A', 'B', 'C'],
    edges: [['A', 'B'], ['C', 'C']],
    start: 'A',
    goal: 'B'
  }
});
const unchangedShift = graphCase({
  id: 'distribution-shift-boundary-unchanged-shift',
  input: baseInput,
  adversarial: true
});
const driftedShift = graphCase({
  id: 'distribution-shift-boundary-drifted-shift',
  taskId: 'distribution-shift-other-task',
  input: {
    nodes: ['A', 'B', 'C'],
    edges: [['A', 'B'], ['C', 'C']],
    start: 'A',
    goal: 'B'
  },
  adversarial: true
});
const noProofBaseline = graphCase({
  id: 'distribution-shift-boundary-no-proof-baseline',
  input: baseInput,
  requiresProof: false
});
const noProofShift = graphCase({
  id: 'distribution-shift-boundary-no-proof-shift',
  input: {
    nodes: ['A', 'B', 'C'],
    edges: [['A', 'B'], ['C', 'C']],
    start: 'A',
    goal: 'B'
  },
  adversarial: true,
  requiresProof: false
});

const runner = new DistributionShiftRunner({
  suiteId: 'distribution-shift-boundary-runner',
  maxShifts: 2
});
assert.throws(
  () => runner.run({
    candidateId: 'plain-baseline',
    baselineCase: {},
    shiftCases: [validShift]
  }),
  /baselineCase must be trusted/
);
assert.throws(
  () => runner.run({
    candidateId: 'empty-shifts',
    baselineCase: baseline,
    shiftCases: []
  }),
  /at least one shift case/
);
assert.throws(
  () => runner.run({
    candidateId: 'plain-shift',
    baselineCase: baseline,
    shiftCases: [{}]
  }),
  /trusted EvaluationCase instances/
);
assert.throws(
  () => runner.run({
    candidateId: 'ordinary-shift',
    baselineCase: baseline,
    shiftCases: [ordinaryShift]
  }),
  /must be adversarial/
);
assert.throws(
  () => runner.run({
    candidateId: 'unchanged-shift',
    baselineCase: baseline,
    shiftCases: [unchangedShift]
  }),
  /must change the baseline input/
);
assert.throws(
  () => runner.run({
    candidateId: 'task-drift',
    baselineCase: baseline,
    shiftCases: [driftedShift]
  }),
  /preserve the baseline task contract/
);
assert.throws(
  () => runner.run({
    candidateId: 'no-proof-baseline',
    baselineCase: noProofBaseline,
    shiftCases: [validShift]
  }),
  /baseline case must require proof/
);
assert.throws(
  () => runner.run({
    candidateId: 'no-proof-shift',
    baselineCase: baseline,
    shiftCases: [noProofShift]
  }),
  /cases must require proof/
);
assert.throws(
  () => runner.run({
    candidateId: 'oversized',
    baselineCase: baseline,
    shiftCases: [validShift, weaknessShift, ordinaryShift]
  }),
  /cannot contain more than 2 cases/
);
assert.throws(
  () => runner.run({
    candidateId: 'duplicate-id',
    baselineCase: baseline,
    shiftCases: [graphCase({
      id: baseline.id,
      input: validShift.input,
      adversarial: true
    })]
  }),
  /case ids must be unique/
);

const accessorRun = {};
Object.defineProperty(accessorRun, 'candidateId', {
  enumerable: true,
  get() {
    throw new Error('accessor should not be read');
  }
});
assert.throws(
  () => runner.run(accessorRun),
  /only enumerable data properties/
);

const accessorExecutionOptions = {
  candidateId: 'accessor-execution-options',
  baselineCase: baseline,
  shiftCases: [validShift]
};
Object.defineProperty(accessorExecutionOptions, 'executionOptions', {
  enumerable: true,
  get() {
    throw new Error('execution accessor should not be read');
  }
});
assert.throws(
  () => runner.run(accessorExecutionOptions),
  /only enumerable data properties/
);

const untrustedRunner = new DistributionShiftRunner({
  suiteId: 'distribution-shift-untrusted-runner',
  runnerFactory: () => ({})
});
assert.throws(
  () => untrustedRunner.run({
    candidateId: 'untrusted-runner',
    baselineCase: baseline,
    shiftCases: [validShift]
  }),
  /must return a trusted EvaluationRunner/
);

const sharedRunner = new EvaluationRunner();
const reusedRunner = new DistributionShiftRunner({
  suiteId: 'distribution-shift-reused-runner',
  runnerFactory: () => sharedRunner
});
assert.throws(
  () => reusedRunner.run({
    candidateId: 'reused-runner',
    baselineCase: baseline,
    shiftCases: [validShift]
  }),
  /evaluation runner cannot be reused/
);

const weakReport = new DistributionShiftRunner({
  suiteId: 'distribution-shift-boundary-positive',
  maxShifts: 1
}).run({
  candidateId: 'distribution-shift-boundary-kernel',
  baselineCase: baseline,
  shiftCases: [weaknessShift]
});
assert.equal(weakReport.baselineSuccess, true);
assert.equal(weakReport.weaknessesExposed, 1);
assert.equal(weakReport.robust, false);
assert.equal(weakReport.requiresReview, true);
assert.equal(Object.hasOwn(weakReport, 'runner'), false);
assert.equal(Object.hasOwn(weakReport, 'harness'), false);
assert.equal(Object.hasOwn(weakReport, 'actionReport'), false);
assert.equal(Object.hasOwn(weakReport, 'promotionAuthority'), false);

assert.throws(
  () => new DistributionShiftReport({
    suiteId: 'forged-report',
    candidateId: 'forged-candidate',
    baseline: Object.freeze({}),
    shifts: []
  }),
  /trusted runner path/
);

assert.throws(
  () => new DistributionShiftRunner({ maxShifts: 0 }),
  /maxShifts must be between/
);
assert.throws(
  () => new DistributionShiftRunner({ maxShifts: 9 }),
  /maxShifts must be between/
);
assert.throws(
  () => new DistributionShiftRunner({ runnerFactory: {} }),
  /runnerFactory must be a function/
);

console.log(
  `FLUID_DISTRIBUTION_SHIFT_BOUNDARY_OK weaknesses=${weakReport.weaknessesExposed} `
  + `robust=${weakReport.robust} reviewRequired=${weakReport.requiresReview} `
  + `untrustedRejected=true reusedRejected=true accessorRejected=true `
  + `taskDriftRejected=true unchangedRejected=true nonAdversarialRejected=true `
  + `proofBoundaryRejected=true capacityRejected=true duplicateRejected=true `
  + `artifactExposureRejected=true authoritySuppressed=${weakReport.authorityTransferred === false}`
);
