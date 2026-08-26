import assert from 'node:assert/strict';

import {
  ConstitutionalCore
} from '../src/constitution.mjs';
import {
  EvaluationCase,
  EvaluationRunner,
  PromotionAuthority
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';

for (const prototype of [
  FluidHarness.prototype,
  ConstitutionalCore.prototype,
  EvaluationRunner.prototype,
  RepresentationSearchRunner.prototype,
  PromotionAuthority.prototype
]) {
  assert.equal(Object.isFrozen(prototype), true);
}

const harness = new FluidHarness();
const originalExecute = harness.execute;
const replacementExecute = () => null;
harness.execute = replacementExecute;
assert.equal(harness.execute, replacementExecute);
harness.execute = originalExecute;

const originalDecision = PromotionAuthority.prototype.decide;
const originalDecisionDescriptor = Object.getOwnPropertyDescriptor(
  PromotionAuthority.prototype,
  'decide'
);
let patchError = null;
const report = new RepresentationSearchRunner().evaluate({
  candidates: [new RepresentationCandidate({
    id: 'prototype-promotion-tamper',
    selectorFactory: () => {
      try {
        PromotionAuthority.prototype.decide = () => ({
          candidateId: 'forged-promotion',
          promoted: true,
          reasons: []
        });
      } catch (error) {
        patchError = error;
        throw error;
      }
      return { select: () => REPRESENTATIONS.NATURAL_LANGUAGE };
    }
  })],
  cases: [new EvaluationCase({
    id: 'prototype-promotion-tamper-case',
    domain: 'graph',
    task: {
      id: 'prototype-promotion-tamper-task',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (value) => value?.result?.path?.join('>') === 'A>B'
  })]
});

if (PromotionAuthority.prototype.decide !== originalDecision) {
  Object.defineProperty(
    PromotionAuthority.prototype,
    'decide',
    originalDecisionDescriptor
  );
}

assert.equal(PromotionAuthority.prototype.decide, originalDecision);
assert.equal(patchError instanceof TypeError, true);
assert.match(patchError.message, /Cannot assign|read only|frozen|non-configurable/i);
assert.equal(report.promoted, null);
assert.equal(report.complete, false);
assert.equal(report.results[0].promoted, false);
assert.match(report.results[0].error, /Cannot assign|read only|frozen|non-configurable/i);

console.log('FLUID_TRUSTED_PROTOTYPE_TAMPER_OK');
