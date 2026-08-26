import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  REPRESENTATIONS,
  RepresentationSelection
} from '../src/representation.mjs';

let representation = REPRESENTATIONS.GRAPH;
const accessorPrototype = Object.create(RepresentationSelection.prototype);
Object.defineProperties(accessorPrototype, {
  representation: {
    get: () => representation,
    enumerable: true
  },
  confidence: {
    value: 1,
    enumerable: true
  },
  ambiguous: {
    value: false,
    enumerable: true
  },
  candidates: {
    value: Object.freeze([]),
    enumerable: true
  }
});

const forgedSelection = Object.freeze(Object.create(accessorPrototype));
const harness = new FluidHarness({
  selector: { select: () => forgedSelection }
});
const plan = harness.plan({
  id: 'representation-selection-snapshot',
  description: 'Find a graph path'
});
const report = harness.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});

assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(Object.isFrozen(report.strategy.selection), true);
assert.equal(Object.getOwnPropertyDescriptor(report.strategy.selection, 'representation').get, undefined);
assert.equal(report.strategy.selection.representation, REPRESENTATIONS.GRAPH);

representation = REPRESENTATIONS.CONSTRAINT_SYSTEM;
assert.equal(report.strategy.representation, REPRESENTATIONS.GRAPH);
assert.equal(report.strategy.selection.representation, REPRESENTATIONS.GRAPH);

console.log('FLUID_REPRESENTATION_SELECTION_SNAPSHOT_OK');
