import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore,
  isTrustedConstitution
} from '../src/constitution.mjs';
import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const spoofed = Object.freeze(Object.assign(Object.create(Constitution.prototype), {
  maxActions: 100,
  maxGraphExpansions: 100,
  maxAuditEntries: 100,
  maxInputBytes: 100,
  maxGraphNodes: 100,
  maxGraphEdges: 100,
  maxConstraintJobs: 100,
  maxArrayElements: 100
}));
assert.equal(spoofed instanceof Constitution, true);
assert.equal(isTrustedConstitution(new Constitution()), true);
assert.equal(isTrustedConstitution(spoofed), false);
assert.throws(
  () => new ConstitutionalCore({ constitution: spoofed }),
  /trusted Constitution/
);

class DerivedConstitution extends Constitution {}
const derived = new DerivedConstitution();
assert.equal(derived instanceof Constitution, true);
assert.equal(isTrustedConstitution(derived), false);
assert.throws(
  () => new ConstitutionalCore({ constitution: derived }),
  /trusted Constitution/
);

const proxied = new Proxy(new Constitution(), {});
assert.equal(isTrustedConstitution(proxied), false);
assert.throws(
  () => new ConstitutionalCore({ constitution: proxied }),
  /trusted Constitution/
);

const report = new RepresentationSearchRunner({
  constitutionFactory: () => spoofed
}).evaluate({
  candidates: [new RepresentationCandidate({
    id: 'constitution-instance-boundary-candidate',
    selectorFactory: () => new HeuristicRepresentationSelector()
  })],
  cases: [new EvaluationCase({
    id: 'constitution-instance-boundary-case',
    domain: 'graph',
    task: {
      id: 'constitution-instance-boundary-task',
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
assert.match(report.results[0].error, /trusted Constitution/);

console.log('FLUID_CONSTITUTION_INSTANCE_BOUNDARY_OK');
