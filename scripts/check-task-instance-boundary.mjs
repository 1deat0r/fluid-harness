import assert from 'node:assert/strict';

import { FluidHarness, Plan } from '../src/harness.mjs';
import {
  HeuristicRepresentationSelector,
  Task,
  isTrustedTask
} from '../src/representation.mjs';

const spoofedPrototype = Object.create(Task.prototype);
Object.defineProperties(spoofedPrototype, {
  id: { get: () => 'task-instance-spoofed-id' },
  description: { get: () => 'Find a graph path' }
});
const spoofed = Object.freeze(Object.create(spoofedPrototype));
assert.equal(spoofed instanceof Task, true);
assert.equal(isTrustedTask(new Task({ id: 'task-instance-real', description: 'Find a graph path' })), true);
assert.equal(isTrustedTask(spoofed), false);

const harness = new FluidHarness();
const normalized = harness.plan(spoofed);
assert.notEqual(normalized.task, spoofed);
assert.equal(isTrustedTask(normalized.task), true);
assert.equal(normalized.task.id, 'task-instance-spoofed-id');
assert.equal(normalized.task.description, 'Find a graph path');
assert.throws(
  () => new HeuristicRepresentationSelector().select(spoofed),
  /requires a Task/
);
assert.throws(
  () => new Plan({
    task: spoofed,
    strategy: normalized.strategy,
    prediction: normalized.prediction
  }),
  /Plan requires a Task/
);

class DerivedTask extends Task {}
const derived = new DerivedTask({ id: 'task-instance-derived', description: 'Find a graph path' });
assert.equal(derived instanceof Task, true);
assert.equal(isTrustedTask(derived), false);
assert.notEqual(harness.plan(derived).task, derived);

const real = new Task({ id: 'task-instance-proxy', description: 'Find a graph path' });
const proxied = new Proxy(real, {});
assert.equal(isTrustedTask(proxied), false);
assert.notEqual(harness.plan(proxied).task, proxied);

console.log('FLUID_TASK_INSTANCE_BOUNDARY_OK');
