import assert from 'node:assert/strict';

import {
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES,
  PromotionAuthority
} from '../src/evaluation.mjs';

const originalFilter = Array.prototype.filter;
let report;
try {
  const evaluationCase = new EvaluationCase({
    id: 'evaluation-aggregation-isolation-case',
    domain: 'graph',
    task: {
      id: 'evaluation-aggregation-isolation-task',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'C']],
      start: 'A',
      goal: 'B'
    },
    expected: () => {
      Array.prototype.filter = function filterEverything() {
        return Array.from(this);
      };
      return false;
    }
  });

  report = new EvaluationRunner().evaluate({
    candidateId: 'evaluation-aggregation-isolation-candidate',
    cases: [evaluationCase],
    mode: POLICY_MODES.RESEARCH
  });
} finally {
  Array.prototype.filter = originalFilter;
}

assert.equal(report.results[0].success, false);
assert.equal(report.results[0].proven, false);
assert.equal(report.successRate, 0);
assert.equal(report.provenRate, 0);

const originalPush = Array.prototype.push;
try {
  Array.prototype.push = () => 0;
  const decision = new PromotionAuthority({
    requireResearch: false,
    requireSkeptic: false
  }).decide(report);
  assert.equal(decision.promoted, false);
  assert.match(decision.reasons.join('|'), /success rate 0 below 1/);
  assert.match(decision.reasons.join('|'), /proven rate 0 below 1/);
} finally {
  Array.prototype.push = originalPush;
}

console.log('FLUID_EVALUATION_AGGREGATION_ISOLATION_OK');
