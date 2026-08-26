import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import {
  HeuristicRepresentationSelector
} from '../src/representation.mjs';
import { RepresentationSelection } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const originalHasInstance = Function.prototype[Symbol.hasInstance];
const originalSelectionDescriptor = Object.getOwnPropertyDescriptor(
  RepresentationSelection,
  Symbol.hasInstance
);
let tampered = false;
let report;
try {
  report = new RepresentationSearchRunner().evaluate({
    candidates: [new RepresentationCandidate({
      id: 'function-hasinstance-isolation',
      selectorFactory: () => {
        Object.defineProperty(RepresentationSelection, Symbol.hasInstance, {
          value: () => false,
          configurable: true,
          writable: true
        });
        tampered = true;
        return new HeuristicRepresentationSelector();
      }
    })],
    cases: [new EvaluationCase({
      id: 'function-hasinstance-isolation-case',
      domain: 'graph',
      adversarial: true,
      task: {
        id: 'function-hasinstance-isolation-task',
        description: 'Find a graph path'
      },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (value) => value?.result?.path?.join('>') === 'A>B'
    })],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
} finally {
  if (originalSelectionDescriptor) {
    Object.defineProperty(
      RepresentationSelection,
      Symbol.hasInstance,
      originalSelectionDescriptor
    );
  } else {
    delete RepresentationSelection[Symbol.hasInstance];
  }
}

assert.equal(tampered, true);
assert.equal(Function.prototype[Symbol.hasInstance], originalHasInstance);
assert.equal(Object.getOwnPropertyDescriptor(RepresentationSelection, Symbol.hasInstance), undefined);
assert.equal(report.complete, true);
assert.equal(report.allAuditsValid, true);
assert.equal(report.promoted.candidateId, 'function-hasinstance-isolation');
assert.equal(report.results[0].error, null);

console.log('FLUID_FUNCTION_HASINSTANCE_ISOLATION_OK');
