import assert from 'node:assert/strict';

import { CognitiveCycleRunner, isTrustedCycleReport } from '../src/cycle.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const cycle = new CognitiveCycleRunner().run({
  task: {
    id: 'program-synthesis-cycle',
    description: 'Implement a function from arithmetic examples'
  },
  input: {
    variables: ['x'],
    constants: [1],
    operators: ['add'],
    maxDepth: 1,
    examples: [
      { inputs: { x: 2 }, output: 3 },
      { inputs: { x: 4 }, output: 5 }
    ]
  },
  reproduction: 'node scripts/check-program-synthesis-cycle.mjs'
});

assert.equal(isTrustedCycleReport(cycle), true);
assert.equal(cycle.stages.represent.representation, 'program-synthesis');
assert.equal(cycle.stages.represent.reasoningEngine, 'program-synthesis');
assert.equal(cycle.stages.represent.executionSubstrate, 'typescript-runtime');
assert.equal(cycle.stages.act.result.expression.op, 'add');
assert.equal(cycle.stages.verify.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(cycle.stages.verify.verifierId, 'finite-program-synthesis-verifier/v1');
assert.equal(cycle.stages.preserve.coreAuditValid, true);

console.log(
  `FLUID_PROGRAM_SYNTHESIS_CYCLE_OK representation=${cycle.stages.represent.representation} `
  + `depth=${cycle.stages.act.result.depth} evidence=${cycle.stages.verify.evidence} `
  + `verifier=${cycle.stages.verify.verifierId} audit=${cycle.stages.preserve.coreAuditValid}`
);
