import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';

const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
Object.defineProperty(input, '__proto__', {
  value: { marker: 'stable' },
  enumerable: true,
  writable: true,
  configurable: true
});

const core = new ConstitutionalCore();
const plan = core.plan({ id: 'proto-snapshot-boundary-plan', description: 'Find a graph path' });
const report = core.execute({ plan, input });

assert.equal(report.evidence, 'PROVEN');
assert.equal(Object.hasOwn(report.input, '__proto__'), true);
assert.equal(report.input.__proto__.marker, 'stable');
assert.equal(Object.getPrototypeOf(report.input), Object.prototype);
assert.equal(core.status.actionsUsed, 1);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_PROTO_SNAPSHOT_BOUNDARY_OK');
