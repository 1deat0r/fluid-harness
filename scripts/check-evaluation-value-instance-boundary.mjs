import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES,
  isTrustedEvaluationBudget,
  isTrustedEvaluationCase
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const validCase = new EvaluationCase({
  id: 'evaluation-value-instance-valid-case',
  domain: 'graph',
  task: {
    id: 'evaluation-value-instance-valid-task',
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
const validBudget = new EvaluationBudget({ maxCases: 1 });
const runner = new EvaluationRunner({ harness: new FluidHarness() });

const spoofedBudget = Object.freeze(Object.create(EvaluationBudget.prototype));
assert.equal(spoofedBudget instanceof EvaluationBudget, true);
assert.equal(Object.isFrozen(spoofedBudget), true);
assert.equal(isTrustedEvaluationBudget(validBudget), true);
assert.equal(isTrustedEvaluationBudget(spoofedBudget), false);
assert.throws(
  () => runner.evaluate({
    candidateId: 'evaluation-value-instance-budget',
    cases: [validCase],
    mode: POLICY_MODES.RESEARCH,
    budget: spoofedBudget
  }),
  /trusted EvaluationBudget/
);

const spoofedCasePrototype = Object.create(EvaluationCase.prototype);
Object.defineProperties(spoofedCasePrototype, {
  id: { get: () => 'evaluation-value-instance-spoofed-case' },
  domain: { get: () => 'graph' },
  task: {
    get: () => ({
      id: 'evaluation-value-instance-spoofed-task',
      description: 'Find a graph path'
    })
  },
  input: {
    get: () => ({
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    })
  },
  expected: { get: () => () => true },
  productionEligible: { get: () => true },
  adversarial: { get: () => false },
  requiresProof: { get: () => true }
});
const spoofedCase = Object.freeze(Object.create(spoofedCasePrototype));
assert.equal(spoofedCase instanceof EvaluationCase, true);
assert.equal(Object.isFrozen(spoofedCase), true);
assert.equal(isTrustedEvaluationCase(validCase), true);
assert.equal(isTrustedEvaluationCase(spoofedCase), false);
assert.throws(
  () => runner.evaluate({
    candidateId: 'evaluation-value-instance-case',
    cases: [spoofedCase],
    mode: POLICY_MODES.RESEARCH,
    budget: validBudget
  }),
  /trusted EvaluationCase/
);

const proxiedBudget = new Proxy(validBudget, {});
assert.equal(isTrustedEvaluationBudget(proxiedBudget), false);
assert.throws(
  () => runner.evaluate({
    candidateId: 'evaluation-value-instance-proxy',
    cases: [validCase],
    mode: POLICY_MODES.RESEARCH,
    budget: proxiedBudget
  }),
  /trusted EvaluationBudget/
);

console.log('FLUID_EVALUATION_VALUE_INSTANCE_BOUNDARY_OK');
