import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';
import { FluidHarness } from '../src/harness.mjs';

const baseInput = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

function accessorInput() {
  const input = {
    ...baseInput,
    nodes: [...baseInput.nodes],
    edges: baseInput.edges.map((edge) => [...edge])
  };
  Object.defineProperty(input, 'goal', {
    configurable: true,
    enumerable: true,
    get() {
      return 'B';
    }
  });
  return input;
}

function assertAccessorRejected(patch) {
  const input = accessorInput();
  const core = new ConstitutionalCore();
  const plan = core.plan({
    id: 'property-introspection-isolation-plan',
    description: 'Find a graph path'
  });
  const originals = patch();
  try {
    assert.throws(
      () => core.execute({ plan, input }),
      /Input is not JSON-serializable|Input must contain only JSON-compatible values/
    );
    assert.equal(core.status.actionsUsed, 0);
  } finally {
    originals.restore();
  }
}

assertAccessorRejected(() => {
  const original = Object.getOwnPropertyDescriptor;
  Object.getOwnPropertyDescriptor = (object, key) => {
    const descriptor = original(object, key);
    if (descriptor && (descriptor.get || descriptor.set)) {
      return {
        value: descriptor.get ? descriptor.get.call(object) : undefined,
        enumerable: descriptor.enumerable,
        writable: true,
        configurable: true
      };
    }
    return descriptor;
  };
  return { restore: () => { Object.getOwnPropertyDescriptor = original; } };
});

assertAccessorRejected(() => {
  const original = Reflect.ownKeys;
  Reflect.ownKeys = () => [];
  return { restore: () => { Reflect.ownKeys = original; } };
});

assertAccessorRejected(() => {
  const original = Object.getPrototypeOf;
  Object.getPrototypeOf = () => Object.prototype;
  return { restore: () => { Object.getPrototypeOf = original; } };
});

assertAccessorRejected(() => {
  const original = Array.isArray;
  Array.isArray = () => false;
  return { restore: () => { Array.isArray = original; } };
});

const sparseNodes = [];
sparseNodes.length = 2;
sparseNodes[1] = 'B';
const sparseInput = {
  nodes: sparseNodes,
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const originalHasOwn = Object.hasOwn;
try {
  Object.hasOwn = () => true;
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'property-introspection-sparse-plan',
    description: 'Find a graph path'
  });
  assert.throws(
    () => harness.execute({ plan, input: sparseInput }),
    /must not contain holes/
  );
} finally {
  Object.hasOwn = originalHasOwn;
}

console.log('FLUID_PROPERTY_INTROSPECTION_ISOLATION_OK');
