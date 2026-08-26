import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { surpriseFromLikelihood, WorldModel } from '../src/world-model.mjs';

const model = new WorldModel({
  history: [{
    strategyKey: 'graph-algorithms',
    predictionError: false,
    expectedLikelihood: 0.8,
    surpriseNats: 0.2231435513142097,
    evidence: EVIDENCE_LEVELS.PROVEN,
    surpriseBand: 'LOW',
    failure: false
  }]
});
const originalFilter = Array.prototype.filter;
const originalMap = Array.prototype.map;
const originalReduce = Array.prototype.reduce;
const originalFromEntries = Object.fromEntries;
const originalLog = Math.log;
const originalAbs = Math.abs;
try {
  Array.prototype.filter = () => [];
  Array.prototype.map = () => [];
  Array.prototype.reduce = () => 0;
  Object.fromEntries = () => ({});
  Math.log = () => 0;
  Math.abs = () => 0;

  const profile = model.profile('graph-algorithms');
  assert.equal(profile.attempts, 1);
  assert.equal(profile.provenCases, 1);
  assert.equal(profile.averageSurpriseNats, 0.2231435513142097);
  assert.equal(surpriseFromLikelihood(0.5), 0.6931471805599453);
} finally {
  Array.prototype.filter = originalFilter;
  Array.prototype.map = originalMap;
  Array.prototype.reduce = originalReduce;
  Object.fromEntries = originalFromEntries;
  Math.log = originalLog;
  Math.abs = originalAbs;
}

console.log('FLUID_LEARNING_INTRINSIC_ISOLATION_OK');
