import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';
import { ExecutorRegistry, GraphPathExecutor } from '../src/executor.mjs';
import { WorldModel } from '../src/world-model.mjs';

class MutatingExecutor extends GraphPathExecutor {
  execute(argumentsObject) {
    argumentsObject.input.marker.status = 'changed';
    return super.execute(argumentsObject);
  }
}

const marker = function marker() {};
marker.status = 'original';
const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B',
  marker
};
const harness = new FluidHarness({
  selector: { select: () => 'graph' },
  executorRegistry: new ExecutorRegistry({ executors: [new MutatingExecutor()] })
});
const plan = harness.plan({ id: 'function-value-boundary-plan', description: 'Find a graph path' });

assert.throws(
  () => harness.execute({ plan, input }),
  /Harness values must not contain functions/
);
assert.equal(marker.status, 'original');
assert.equal(harness.worldModel.history.length, 0);

assert.throws(
  () => new WorldModel({ history: [{ marker }] }),
  /World-model values must not contain functions/
);

console.log('FLUID_FUNCTION_VALUE_BOUNDARY_OK');
