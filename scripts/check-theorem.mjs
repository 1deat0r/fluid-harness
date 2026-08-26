import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';

const proofHarness = new FluidHarness();
const proofPlan = proofHarness.plan({
  id: 'theorem-check',
  description: 'Prove a formal theorem from assumptions'
});
assert.equal(proofPlan.strategy.representation, REPRESENTATIONS.THEOREM);
const proofReport = proofHarness.execute({
  plan: proofPlan,
  input: {
    variables: ['p', 'q'],
    assumptions: [
      { op: 'implies', left: { op: 'var', name: 'p' }, right: { op: 'var', name: 'q' } },
      { op: 'var', name: 'p' }
    ],
    conclusion: { op: 'var', name: 'q' }
  },
  reproduction: 'node scripts/check-theorem.mjs'
});
assert.equal(proofReport.result.proved, true);
assert.equal(proofReport.result.counterexample, null);
assert.equal(proofReport.result.assignmentsChecked, 4);
assert.equal(proofReport.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(proofReport.verification.verifierId, 'theorem-prover-verifier/v1');
assert.equal(proofReport.verification.passed, true);

const refutationHarness = new FluidHarness();
const refutationPlan = refutationHarness.plan({
  id: 'theorem-refutation-check',
  description: 'Prove a formal theorem'
});
const refutationReport = refutationHarness.execute({
  plan: refutationPlan,
  input: {
    variables: ['p'],
    assumptions: [{ op: 'var', name: 'p' }],
    conclusion: { op: 'false' }
  }
});
assert.equal(refutationReport.result.proved, false);
assert.deepEqual(refutationReport.result.counterexample, { p: true });
assert.equal(refutationReport.evidence, EVIDENCE_LEVELS.PROVEN);

console.log(
  `FLUID_THEOREM_OK representation=${proofPlan.strategy.representation} `
  + `proved=${proofReport.result.proved} refuted=${!refutationReport.result.proved} `
  + `assignments=${proofReport.result.assignmentsChecked} evidence=${proofReport.evidence} `
  + `verifier=${proofReport.verification.verifierId}`
);
