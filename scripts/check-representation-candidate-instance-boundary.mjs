import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner,
  isTrustedRepresentationCandidate
} from '../src/search.mjs';

const selectorFactory = () => new HeuristicRepresentationSelector();
const spoofedPrototype = Object.create(RepresentationCandidate.prototype);
Object.defineProperties(spoofedPrototype, {
  id: { get: () => 'candidate-instance-spoofed' },
  description: { get: () => 'prototype-only candidate' },
  selectorFactory: { get: () => selectorFactory }
});
const spoofed = Object.freeze(Object.create(spoofedPrototype));
assert.equal(spoofed instanceof RepresentationCandidate, true);
assert.equal(isTrustedRepresentationCandidate(spoofed), false);

const report = new RepresentationSearchRunner().evaluate({
  candidates: [spoofed],
  cases: [new EvaluationCase({
    id: 'candidate-instance-boundary-case',
    domain: 'graph',
    adversarial: true,
    task: {
      id: 'candidate-instance-boundary-task',
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
assert.equal(report.results[0].error, null);
assert.notEqual(report.results[0].candidate, spoofed);
assert.equal(isTrustedRepresentationCandidate(report.results[0].candidate), true);
assert.equal(report.results[0].candidate.id, 'candidate-instance-spoofed');

const real = new RepresentationCandidate({
  id: 'candidate-instance-real',
  selectorFactory
});
assert.equal(isTrustedRepresentationCandidate(real), true);
const proxied = new Proxy(real, {});
assert.equal(isTrustedRepresentationCandidate(proxied), false);

console.log('FLUID_REPRESENTATION_CANDIDATE_INSTANCE_BOUNDARY_OK');
