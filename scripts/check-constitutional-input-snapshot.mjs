import assert from 'node:assert/strict';

import {
  CORE_EVENTS,
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';

const core = new ConstitutionalCore({
  constitution: new Constitution({ maxGraphNodes: 2 })
});
const plan = core.plan({
  id: 'constitutional-input-snapshot-plan',
  description: 'Find a graph path'
});
const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

const report = core.execute({ plan, input });
input.nodes.push('C');
input.edges.push(['A', 'C']);
assert.deepEqual(report.input.nodes, ['A', 'B']);
assert.deepEqual(report.result.path, ['A', 'B']);

const admission = core.auditTrail.find(({ event }) => event === CORE_EVENTS.ACTION_ADMITTED);
assert.equal(
  admission.payload.inputBytes,
  Buffer.byteLength(JSON.stringify({
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }), 'utf8')
);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_CONSTITUTIONAL_INPUT_SNAPSHOT_OK');
