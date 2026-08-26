import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';

const core = new ConstitutionalCore();
const plan = core.plan({
  id: 'audit-iterator-isolation-plan',
  description: 'Find a graph path'
});
core.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});

const originalIterator = Array.prototype[Symbol.iterator];
const auditLength = core.auditTrail.length;
try {
  Array.prototype[Symbol.iterator] = function emptyIterator() {
    return [][Symbol.iterator]();
  };
  assert.equal(core.verifyAudit(), true);
  assert.equal(core.auditTrail.length, auditLength);
  assert.equal(core.auditTrail[0].sequence, 1);
  assert.equal(core.auditTrail[auditLength - 1].sequence, auditLength);
} finally {
  Array.prototype[Symbol.iterator] = originalIterator;
}

console.log('FLUID_AUDIT_ITERATOR_ISOLATION_OK');
