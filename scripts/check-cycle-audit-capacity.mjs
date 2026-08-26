import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';
import { CognitiveCycleRunner, isTrustedCycleReport } from '../src/cycle.mjs';

const blockedCore = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 1, maxAuditEntries: 2 })
});
assert.throws(
  () => new CognitiveCycleRunner({ core: blockedCore }).run({
    task: { id: 'cycle-audit-capacity-blocked', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }),
  /requires three available audit entries/
);
assert.equal(blockedCore.status.actionsUsed, 0);
assert.equal(blockedCore.learningHistory.length, 0);
assert.equal(blockedCore.auditTrail.length, 0);
assert.equal(blockedCore.verifyAudit(), true);

const admittedCore = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 1, maxAuditEntries: 3 })
});
const cycle = new CognitiveCycleRunner({ core: admittedCore }).run({
  task: { id: 'cycle-audit-capacity-admitted', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});
assert.equal(isTrustedCycleReport(cycle), true);
assert.deepEqual(
  admittedCore.auditTrail.map(({ event }) => event),
  ['action-admitted', 'action-completed', 'question-decided']
);
assert.equal(admittedCore.verifyAudit(), true);

console.log('FLUID_CYCLE_AUDIT_CAPACITY_OK');
