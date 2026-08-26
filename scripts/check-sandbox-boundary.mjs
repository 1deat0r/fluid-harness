import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  Constitution,
  ConstitutionalCore,
  CORE_EVENTS
} from '../src/constitution.mjs';

const core = new ConstitutionalCore({
  constitution: new Constitution({
    maxActions: 2,
    maxGraphExpansions: 4,
    maxGraphNodes: 2,
    maxGraphEdges: 2,
    maxInputBytes: 512,
    maxAuditEntries: 32
  })
});
const plan = core.plan({ id: 'sandbox-boundary', description: 'Find a graph path' });

assert.throws(
  () => core.execute({
    plan,
    input: {
      nodes: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      start: 'A',
      goal: 'C'
    }
  }),
  /Graph node count 3 exceeds constitutional limit 2/
);

const cyclic = {};
cyclic.self = cyclic;
assert.throws(
  () => core.execute({ plan, input: cyclic }),
  /not JSON-serializable/
);

const good = core.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});

assert.equal(good.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(core.status.actionsUsed, 1);
assert.equal(core.auditTrail.filter(({ event }) => event === CORE_EVENTS.ACTION_REJECTED).length, 2);
assert.equal(core.verifyAudit(), true);
console.log(`FLUID_SANDBOX_OK actions=${core.status.actionsUsed} rejected=2 audit=${core.auditTrail.length}`);
