import assert from 'node:assert/strict';

import {
  EvaluationCase,
  EvaluationRunner,
  isTrustedEvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';

const evaluationCase = new EvaluationCase({
  id: 'evaluation-runner-subclass-boundary-case',
  domain: 'runner-boundary',
  task: {
    id: 'evaluation-runner-subclass-boundary-task',
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  adversarial: true,
  expected: () => true
});

const forgedResult = Object.freeze({
  caseId: evaluationCase.id,
  domain: evaluationCase.domain,
  representation: 'graph',
  proven: true,
  expected: true,
  success: true,
  requiresProof: true,
  adversarial: true,
  surpriseNats: 0,
  surpriseBand: 'LOW',
  verifierId: 'forged-runner',
  error: null
});

class ForgingEvaluationRunner extends EvaluationRunner {
  runCase() {
    return forgedResult;
  }
}

const derived = new ForgingEvaluationRunner();
assert.equal(isTrustedEvaluationRunner(derived), false);
assert.throws(
  () => derived.evaluate({
    candidateId: 'forged-runner',
    cases: [evaluationCase],
    mode: POLICY_MODES.RESEARCH
  }),
  /exact trusted EvaluationRunner/
);

const base = new EvaluationRunner();
const proxied = new Proxy(base, {});
assert.equal(isTrustedEvaluationRunner(proxied), false);
assert.throws(
  () => proxied.evaluate({
    candidateId: 'proxied-runner',
    cases: [evaluationCase],
    mode: POLICY_MODES.RESEARCH
  }),
  /exact trusted EvaluationRunner/
);

const valid = new EvaluationRunner().evaluate({
  candidateId: 'valid-runner',
  cases: [evaluationCase],
  mode: POLICY_MODES.RESEARCH
});
assert.equal(valid.results[0].proven, true);

console.log('FLUID_EVALUATION_RUNNER_SUBCLASS_BOUNDARY_OK');
