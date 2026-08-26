import assert from 'node:assert/strict';

import { CognitiveCycleRunner, isTrustedCycleReport } from '../src/cycle.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const cycle = new CognitiveCycleRunner().run({
  task: {
    id: 'theorem-cycle',
    description: 'Prove a formal theorem from assumptions'
  },
  input: {
    variables: ['p', 'q'],
    assumptions: [
      { op: 'implies', left: { op: 'var', name: 'p' }, right: { op: 'var', name: 'q' } },
      { op: 'var', name: 'p' }
    ],
    conclusion: { op: 'var', name: 'q' }
  },
  reproduction: 'node scripts/check-theorem-cycle.mjs'
});

assert.equal(isTrustedCycleReport(cycle), true);
assert.equal(cycle.stages.represent.representation, 'theorem');
assert.equal(cycle.stages.represent.reasoningEngine, 'theorem-prover');
assert.equal(cycle.stages.act.result.proved, true);
assert.equal(cycle.stages.verify.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(cycle.stages.verify.verifierId, 'theorem-prover-verifier/v1');
assert.equal(cycle.stages.preserve.coreAuditValid, true);

console.log(
  `FLUID_THEOREM_CYCLE_OK representation=${cycle.stages.represent.representation} `
  + `evidence=${cycle.stages.verify.evidence} verifier=${cycle.stages.verify.verifierId} `
  + `audit=${cycle.stages.preserve.coreAuditValid}`
);
