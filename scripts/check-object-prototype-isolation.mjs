import assert from 'node:assert/strict';

import {
  GraphPathExecutor
} from '../src/executor.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';

const originalObject = Object;
const hostilePrototype = { hostile: true };
const input = originalObject.create(hostilePrototype);
input.nodes = ['A', 'B'];
input.edges = [['A', 'B']];
input.start = 'A';
input.goal = 'B';
const executionOptions = originalObject.create(hostilePrototype);
let prototypeReads = 0;
const objectTarget = (...args) => originalObject(...args);
const tamperedObject = new Proxy(objectTarget, {
  get(target, key, receiver) {
    if (key === 'prototype') {
      const value = [
        hostilePrototype,
        originalObject.prototype,
        hostilePrototype,
        originalObject.prototype
      ][prototypeReads] ?? originalObject.prototype;
      prototypeReads += 1;
      return value;
    }
    return Reflect.get(target, key, receiver);
  }
});

try {
  globalThis.Object = tamperedObject;
  assert.throws(
    () => new GraphPathExecutor().execute({
      task: { id: 'object-prototype-isolation-task' },
      strategy: {
        representation: REPRESENTATIONS.GRAPH,
        reasoningEngine: REASONING_ENGINES.GRAPH_ALGORITHMS
      },
      input,
      executionOptions
    }),
    /plain objects and arrays/
  );
} finally {
  globalThis.Object = originalObject;
}

console.log('FLUID_OBJECT_PROTOTYPE_ISOLATION_OK');
