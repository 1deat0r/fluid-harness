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
  id: 'program-synthesis-check',
  description: 'Implement a function from arithmetic examples'
});
const report = harness.execute({
  plan,
  input: {
    variables: ['x'],
    constants: [1],
    operators: ['add'],
    maxDepth: 1,
    examples: [
      { inputs: { x: 1 }, output: 2 },
      { inputs: { x: 2 }, output: 3 },
      { inputs: { x: 5 }, output: 6 }
    ]
  },
  reproduction: 'node scripts/check-program-synthesis.mjs'
});

assert.equal(plan.strategy.representation, REPRESENTATIONS.PROGRAM_SYNTHESIS);
assert.equal(plan.strategy.reasoningEngine, REASONING_ENGINES.PROGRAM_SYNTHESIS);
assert.equal(plan.strategy.executionSubstrate, EXECUTION_SUBSTRATES.TYPESCRIPT_RUNTIME);
assert.equal(report.result.expression.op, 'add');
assert.equal(report.result.depth, 1);
assert.equal(report.result.examplesChecked, 3);
assert.equal(report.result.synthesisComplete, true);
assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(report.verification.verifierId, 'finite-program-synthesis-verifier/v1');
assert.equal(report.verification.passed, true);

console.log(
  `FLUID_PROGRAM_SYNTHESIS_OK representation=${plan.strategy.representation} `
  + `engine=${plan.strategy.reasoningEngine} substrate=${plan.strategy.executionSubstrate} `
  + `expression=${report.result.expression.op} evidence=${report.evidence} `
  + `verifier=${report.verification.verifierId}`
);
