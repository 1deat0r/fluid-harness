import assert from 'node:assert/strict';

import {
  CORE_EVENTS,
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';

const core = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2, maxAuditEntries: 16 })
});
const plan = core.plan({
  id: 'constitutional-options-boundary',
  description: 'Find a graph path'
});
const cyclicMetadata = {};
cyclicMetadata.self = cyclicMetadata;

assert.throws(
  () => core.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    executionOptions: { metadata: cyclicMetadata }
  }),
  /cyclic|serializable|stack/i
);
assert.equal(core.status.actionsUsed, 0);
assert.equal(
  core.auditTrail.filter(({ event }) => event === CORE_EVENTS.ACTION_ADMITTED).length,
  0
);
assert.equal(
  core.auditTrail.filter(({ event }) => event === CORE_EVENTS.ACTION_REJECTED).length,
  1
);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_CONSTITUTIONAL_OPTIONS_BOUNDARY_OK');
