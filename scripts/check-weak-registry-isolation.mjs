import assert from 'node:assert/strict';

import { isTrustedCycleReport } from '../src/cycle.mjs';
import { isTrustedQuestionDecision } from '../src/curiosity.mjs';

const forged = Object.freeze({});
const originalWeakSetHas = WeakSet.prototype.has;
const originalWeakMapGet = WeakMap.prototype.get;
try {
  WeakSet.prototype.has = () => true;
  assert.equal(isTrustedCycleReport(forged), false);

  WeakMap.prototype.get = () => ({ forged: true });
  assert.equal(isTrustedQuestionDecision(forged), false);
} finally {
  WeakSet.prototype.has = originalWeakSetHas;
  WeakMap.prototype.get = originalWeakMapGet;
}

console.log('FLUID_WEAK_REGISTRY_ISOLATION_OK');
