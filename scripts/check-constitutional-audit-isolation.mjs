import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';

const originalMap = Array.prototype.map;
const originalJoin = Array.prototype.join;
const originalSort = Array.prototype.sort;
const originalKeys = Object.keys;
const originalFinite = Number.isFinite;

const core = new ConstitutionalCore();
const plan = core.plan({
  id: 'constitutional-audit-isolation-plan',
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

try {
  Array.prototype.map = () => [];
  Array.prototype.join = () => 'tampered';
  Array.prototype.sort = () => [];
  Object.keys = () => [];
  Number.isFinite = () => false;
  assert.equal(core.verifyAudit(), true);
} finally {
  Array.prototype.map = originalMap;
  Array.prototype.join = originalJoin;
  Array.prototype.sort = originalSort;
  Object.keys = originalKeys;
  Number.isFinite = originalFinite;
}

console.log('FLUID_CONSTITUTIONAL_AUDIT_ISOLATION_OK');
