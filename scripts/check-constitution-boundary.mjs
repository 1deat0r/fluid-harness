import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  Constitution,
  ConstitutionalCore,
  CORE_EVENTS
} from '../src/constitution.mjs';
import { POLICY_MODES } from '../src/evaluation.mjs';

const core = new ConstitutionalCore({
  constitution: new Constitution({
    maxActions: 2,
    maxGraphExpansions: 2,
    maxAuditEntries: 32
  })
});

assert.equal(Object.isFrozen(core), true);
assert.equal(Object.isFrozen(core.constitution), true);

const limitedPlan = core.plan({
  id: 'constitution-limited',
  description: 'Find the shortest path through a dependency graph'
});
const limited = core.execute({
  plan: limitedPlan,
  input: {
    nodes: ['A', 'B', 'C'],
    edges: [['A', 'B'], ['B', 'C']],
    start: 'A',
    goal: 'C'
  },
  policyMode: POLICY_MODES.RESEARCH,
  executionOptions: { maxExpansions: 1 }
});

assert.equal(limited.result.searchComplete, false);
assert.equal(limited.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(core.status.actionsUsed, 1);
assert.throws(
  () => core.execute({
    plan: limitedPlan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    executionOptions: { maxExpansions: 3 }
  }),
  /exceeds constitutional limit/
);
assert.equal(core.status.actionsUsed, 1);

core.shutdown('operator requested review');
assert.equal(core.status.shutdown, true);
assert.throws(
  () => core.execute({ plan: limitedPlan, input: {} }),
  /core is shutdown/
);
core.resume('operator completed review');
assert.equal(core.status.shutdown, false);

const fullPlan = core.plan({
  id: 'constitution-full',
  description: 'Find the shortest path through a dependency graph'
});
const full = core.execute({
  plan: fullPlan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  policyMode: POLICY_MODES.PRODUCTION
});

assert.equal(full.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(core.status.actionsUsed, 2);
assert.equal(core.status.remainingActions, 0);
assert.equal(core.verifyAudit(), true);
assert.ok(core.auditTrail.some(({ event }) => event === CORE_EVENTS.SHUTDOWN));
assert.ok(core.auditTrail.some(({ event }) => event === CORE_EVENTS.RESUMED));
assert.ok(core.auditTrail.every(({ hash }) => /^sha256:[0-9a-f]{64}$/.test(hash)));
assert.ok(core.auditTrail.every((entry) => Object.isFrozen(entry)));
assert.throws(() => {
  core.auditTrail[0].hash = 'tampered';
}, TypeError);
assert.equal(core.verifyAudit(), true);

console.log(`FLUID_CONSTITUTION_OK actions=${core.status.actionsUsed} audit=${core.auditTrail.length} shutdown-resume=true`);
