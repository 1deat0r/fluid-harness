import assert from 'node:assert/strict';

import { CognitiveCycleRunner, isTrustedCycleReport } from '../src/cycle.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const cycle = new CognitiveCycleRunner().run({
  task: {
    id: 'optimization-cycle',
    description: 'Optimize a finite candidate set'
  },
  input: {
    objective: 'maximize',
    candidates: [
      { id: 'small', value: 1 },
      { id: 'large', value: 8 }
    ]
  },
  reproduction: 'node scripts/check-optimization-cycle.mjs'
});

assert.equal(isTrustedCycleReport(cycle), true);
assert.equal(cycle.stages.represent.representation, 'optimization');
assert.equal(cycle.stages.represent.reasoningEngine, 'numerical-optimizer');
assert.equal(cycle.stages.act.result.selectedId, 'large');
assert.equal(cycle.stages.verify.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(cycle.stages.verify.verifierId, 'finite-optimizer-verifier/v1');
assert.equal(cycle.stages.preserve.coreAuditValid, true);

console.log(
  `FLUID_OPTIMIZATION_CYCLE_OK representation=${cycle.stages.represent.representation} `
  + `selected=${cycle.stages.act.result.selectedId} evidence=${cycle.stages.verify.evidence} `
  + `verifier=${cycle.stages.verify.verifierId} audit=${cycle.stages.preserve.coreAuditValid}`
);
