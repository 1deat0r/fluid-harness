import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';

const baseInput = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

function assertRejected(extra) {
  const core = new ConstitutionalCore();
  const plan = core.plan({ id: 'constitutional-value-boundary-plan', description: 'Find a graph path' });
  assert.throws(
    () => core.execute({
      plan,
      input: { ...baseInput, ...extra }
    }),
    /Input must contain only JSON-compatible values/
  );
  assert.equal(core.status.actionsUsed, 0);
}

assertRejected({ marker: function marker() {} });
assertRejected({ metadata: new Map([['status', 'original']]) });
assertRejected({ metadata: new Set(['original']) });
assertRejected({ missing: undefined });
assertRejected({ marker: Symbol('unsupported') });
assertRejected({ amount: 1n });
assertRejected({ amount: Number.NaN });
assertRejected({ amount: Number.POSITIVE_INFINITY });

console.log('FLUID_CONSTITUTIONAL_VALUE_BOUNDARY_OK');
