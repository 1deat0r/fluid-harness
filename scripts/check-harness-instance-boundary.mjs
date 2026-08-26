import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';
import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import {
  FluidHarness,
  isTrustedHarness
} from '../src/harness.mjs';
import { ScalingRunner } from '../src/scaling.mjs';

const spoofed = Object.freeze(Object.create(FluidHarness.prototype));
assert.equal(spoofed instanceof FluidHarness, true);
const valid = new FluidHarness();
assert.equal(isTrustedHarness(valid), true);
assert.equal(isTrustedHarness(spoofed), false);
assert.throws(
  () => new ConstitutionalCore({
    constitution: new Constitution(),
    harness: spoofed
  }),
  /trusted FluidHarness/
);
assert.throws(
  () => new EvaluationRunner({ harness: spoofed }),
  /trusted FluidHarness/
);

class DerivedHarness extends FluidHarness {}
const derived = new DerivedHarness();
assert.equal(derived instanceof FluidHarness, true);
assert.equal(isTrustedHarness(derived), true);
assert.doesNotThrow(() => new EvaluationRunner({ harness: derived }));

const proxied = new Proxy(valid, {});
assert.equal(isTrustedHarness(proxied), false);
assert.throws(
  () => new EvaluationRunner({ harness: proxied }),
  /trusted FluidHarness/
);

const evaluationCase = new EvaluationCase({
  id: 'harness-instance-boundary-case',
  domain: 'graph',
  task: {
    id: 'harness-instance-boundary-task',
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (value) => value?.result?.path?.join('>') === 'A>B'
});
assert.throws(
  () => new ScalingRunner({ harnessFactory: () => spoofed }).evaluate({
    candidateId: 'harness-instance-boundary',
    cases: [evaluationCase],
    mode: POLICY_MODES.RESEARCH,
    levels: [{ id: 'harness-instance-boundary-level', computeUnits: 1 }]
  }),
  /trusted FluidHarness/
);
assert.equal(new EvaluationBudget({ maxCases: 1 }).maxCases, 1);

console.log('FLUID_HARNESS_INSTANCE_BOUNDARY_OK');
