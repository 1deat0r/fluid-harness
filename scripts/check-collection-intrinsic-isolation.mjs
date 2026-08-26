import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';

const originals = {
  setHas: Set.prototype.has,
  setAdd: Set.prototype.add,
  setDelete: Set.prototype.delete,
  mapGet: Map.prototype.get,
  mapSet: Map.prototype.set,
  mapHas: Map.prototype.has,
  mapDelete: Map.prototype.delete,
  setSize: Object.getOwnPropertyDescriptor(Set.prototype, 'size'),
  mapSize: Object.getOwnPropertyDescriptor(Map.prototype, 'size')
};
const harness = new FluidHarness();
const plan = harness.plan({
  id: 'collection-intrinsic-isolation-task',
  description: 'Find a graph path'
});
let report;
try {
  Set.prototype.has = () => false;
  Set.prototype.add = () => {};
  Set.prototype.delete = () => false;
  Map.prototype.get = () => undefined;
  Map.prototype.set = () => {
    throw new Error('tampered Map.set');
  };
  Map.prototype.has = () => false;
  Map.prototype.delete = () => false;
  Object.defineProperty(Set.prototype, 'size', {
    configurable: true,
    get: () => 999
  });
  Object.defineProperty(Map.prototype, 'size', {
    configurable: true,
    get: () => 999
  });
  report = harness.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  });
} finally {
  Set.prototype.has = originals.setHas;
  Set.prototype.add = originals.setAdd;
  Set.prototype.delete = originals.setDelete;
  Map.prototype.get = originals.mapGet;
  Map.prototype.set = originals.mapSet;
  Map.prototype.has = originals.mapHas;
  Map.prototype.delete = originals.mapDelete;
  Object.defineProperty(Set.prototype, 'size', originals.setSize);
  Object.defineProperty(Map.prototype, 'size', originals.mapSize);
}

assert.equal(report.evidence, 'PROVEN');
assert.deepEqual(report.result.path, ['A', 'B']);
assert.equal(report.verification?.passed, true);

console.log('FLUID_COLLECTION_INTRINSIC_ISOLATION_OK');
