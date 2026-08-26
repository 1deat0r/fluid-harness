import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  EXECUTION_SUBSTRATES,
  REASONING_ENGINES,
  REPRESENTATIONS
} from '../src/representation.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'optimization-check',
  description: 'Optimize a finite candidate set'
});
const report = harness.execute({
  plan,
  input: {
    objective: 'minimize',
    candidates: [
      { id: 'slow', value: 9 },
      { id: 'fast', value: 2 },
      { id: 'other', value: 2 }
    ]
  },
  reproduction: 'node scripts/check-optimization.mjs'
});

assert.equal(plan.strategy.representation, REPRESENTATIONS.OPTIMIZATION);
assert.equal(plan.strategy.reasoningEngine, REASONING_ENGINES.NUMERICAL_OPTIMIZER);
assert.equal(plan.strategy.executionSubstrate, EXECUTION_SUBSTRATES.DETERMINISTIC_KERNEL);
assert.equal(report.result.selectedId, 'fast');
assert.equal(report.result.selectedValue, 2);
assert.equal(report.result.candidatesEvaluated, 3);
assert.equal(report.result.tieBreak, 'lexicographic-id');
assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(report.verification.verifierId, 'finite-optimizer-verifier/v1');
assert.equal(report.verification.passed, true);
assert.equal(report.surpriseBand, 'LOW');

const maximizeHarness = new FluidHarness();
const maximizePlan = maximizeHarness.plan({
  id: 'optimization-maximize-check',
  description: 'Maximize a finite candidate set'
});
const maximizeReport = maximizeHarness.execute({
  plan: maximizePlan,
  input: {
    objective: 'maximize',
    candidates: [
      { id: 'small', value: 1 },
      { id: 'large', value: 8 }
    ]
  }
});
assert.equal(maximizeReport.result.selectedId, 'large');
assert.equal(maximizeReport.evidence, EVIDENCE_LEVELS.PROVEN);

console.log(
  `FLUID_OPTIMIZATION_OK representation=${plan.strategy.representation} `
  + `objective=${report.result.objective} selected=${report.result.selectedId} `
  + `maximize=${maximizeReport.result.selectedId} evidence=${report.evidence} `
  + `verifier=${report.verification.verifierId}`
);
