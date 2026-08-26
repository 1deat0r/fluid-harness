import assert from 'node:assert/strict';

import {
  CORE_EVENTS,
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ScalingLevel, ScalingPoint } from '../src/scaling.mjs';

const unsafe = Number.MAX_SAFE_INTEGER + 2;
const safeIntegerError = /safe integer/;

for (const field of [
  'maxActions',
  'maxGraphExpansions',
  'maxAuditEntries',
  'maxInputBytes',
  'maxGraphNodes',
  'maxGraphEdges',
  'maxConstraintJobs',
  'maxArrayElements'
]) {
  assert.throws(
    () => new Constitution({ [field]: unsafe }),
    safeIntegerError
  );
}

assert.throws(
  () => new EvaluationBudget({ maxCases: unsafe }),
  safeIntegerError
);

assert.throws(
  () => new ScalingLevel({ id: 'unsafe-level', computeUnits: unsafe }),
  safeIntegerError
);

assert.throws(
  () => new ScalingPoint({
    levelId: 'unsafe-point',
    computeUnits: unsafe,
    eligibleCases: 1,
    attemptedCases: 1,
    successes: 1,
    proofEligibleCases: 1,
    proven: 1,
    highSurpriseCases: 0,
    elapsedMs: 0,
    complete: true,
    transferMatrix: {}
  }),
  safeIntegerError
);

const core = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2 })
});
const plan = core.plan({
  id: 'configuration-safe-integer-boundary',
  description: 'Find a graph path'
});

assert.throws(
  () => core.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    executionOptions: { maxExpansions: unsafe }
  }),
  safeIntegerError
);
assert.equal(core.status.actionsUsed, 0);
assert.equal(
  core.auditTrail.filter(({ event }) => event === CORE_EVENTS.ACTION_ADMITTED).length,
  0
);
assert.equal(
  core.auditTrail.filter(({ event }) => event === CORE_EVENTS.ACTION_REJECTED).length,
  1
);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_CONFIGURATION_SAFE_INTEGER_BOUNDARY_OK');
