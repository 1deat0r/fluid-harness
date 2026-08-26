import assert from 'node:assert/strict';

import { CognitiveCycleRunner, isTrustedCycleReport } from '../src/cycle.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const cycle = new CognitiveCycleRunner().run({
  task: {
    id: 'bayesian-cycle',
    description: 'Calculate a Bayesian posterior probability'
  },
  input: {
    observation: 'wet',
    hypotheses: [
      { id: 'rain', prior: 0.2, likelihoods: { wet: 0.9, dry: 0.1 } },
      { id: 'clear', prior: 0.8, likelihoods: { wet: 0.2, dry: 0.8 } }
    ]
  },
  reproduction: 'node scripts/check-bayesian-cycle.mjs'
});

assert.equal(isTrustedCycleReport(cycle), true);
assert.equal(cycle.stages.represent.representation, 'probabilistic-inference');
assert.equal(cycle.stages.represent.reasoningEngine, 'bayesian-inference');
assert.equal(cycle.stages.act.result.mostLikely, 'rain');
assert.equal(cycle.stages.verify.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(cycle.stages.verify.verifierId, 'bayesian-inference-verifier/v1');
assert.equal(cycle.stages.preserve.coreAuditValid, true);

console.log(
  `FLUID_BAYESIAN_CYCLE_OK representation=${cycle.stages.represent.representation} `
  + `mostLikely=${cycle.stages.act.result.mostLikely} evidence=${cycle.stages.verify.evidence} `
  + `verifier=${cycle.stages.verify.verifierId} audit=${cycle.stages.preserve.coreAuditValid}`
);
