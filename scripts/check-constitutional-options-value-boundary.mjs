import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';

const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

function assertRejected(executionOptions) {
  const core = new ConstitutionalCore();
  const plan = core.plan({ id: 'constitutional-options-value-boundary-plan', description: 'Find a graph path' });
  assert.throws(
    () => core.execute({ plan, input, executionOptions }),
    /Constitutional executionOptions must contain only JSON-compatible values/
  );
  assert.equal(core.status.actionsUsed, 0);
  assert.equal(core.auditTrail.at(-1).event, 'action-rejected');
}

assertRejected({ metadata: new Map([['status', 'original']]) });
assertRejected({ metadata: new Set(['original']) });
assertRejected({ marker: function marker() {} });
assertRejected({ metadata: { toJSON: () => ({}) } });

console.log('FLUID_CONSTITUTIONAL_OPTIONS_VALUE_BOUNDARY_OK');
