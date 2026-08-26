import assert from 'node:assert/strict';

import {
  AdversarialLineageRunner,
  isTrustedAdversarialLineageReport
} from '../src/adversarial-lineage.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  EvaluationCase,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const cases = [
  new EvaluationCase({
    id: 'adversarial-lineage-ledger-success',
    domain: 'graph',
    adversarial: true,
    task: { id: 'adversarial-lineage-ledger-success-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
  }),
  new EvaluationCase({
    id: 'adversarial-lineage-ledger-weakness',
    domain: 'graph',
    adversarial: true,
    task: { id: 'adversarial-lineage-ledger-weakness-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [],
      start: 'A',
      goal: 'B'
    },
    expected: () => false
  })
];
const report = new AdversarialLineageRunner({
  lineageId: 'adversarial-lineage-ledger'
}).run({
  candidateId: 'ledger-kernel',
  cases
});
const ledger = new EvidenceLedger();
const record = ledger.appendAdversarialLineage(report);

assert.equal(ledger.verify(), true);
assert.equal(record.kind, 'adversarial-lineage');
assert.equal(record.payload.lineageId, report.lineageId);
assert.equal(record.payload.mode, POLICY_MODES.SKEPTIC);
assert.equal(record.payload.weaknessesExposed, 1);
assert.equal(record.payload.productionEligible, false);
assert.equal(record.payload.authorityTransferred, false);
assert.equal(Object.isFrozen(record), true);
assert.equal(Object.isFrozen(record.payload), true);
assert.equal(Object.hasOwn(record.payload, 'runner'), false);
assert.equal(Object.hasOwn(record.payload, 'harness'), false);
assert.equal(Object.hasOwn(record.payload, 'actionReport'), false);

const restored = EvidenceLedger.fromSerialized(ledger.serialize());
const lineages = restored.restoreAdversarialLineages();
assert.equal(restored.verify(), true);
assert.equal(lineages.length, 1);
assert.equal(isTrustedAdversarialLineageReport(lineages[0]), false);
assert.equal(Object.isFrozen(lineages), true);
assert.equal(Object.isFrozen(lineages[0]), true);
assert.equal(Object.isFrozen(lineages[0].results), true);
assert.equal(lineages[0].lineageId, report.lineageId);
assert.equal(lineages[0].candidateId, report.candidateId);
assert.equal(lineages[0].mode, report.mode);
assert.equal(lineages[0].eligibleCases, report.eligibleCases);
assert.equal(lineages[0].attemptedCases, report.attemptedCases);
assert.equal(lineages[0].adversarialSuccesses, report.adversarialSuccesses);
assert.equal(lineages[0].weaknessesExposed, report.weaknessesExposed);
assert.equal(lineages[0].complete, true);
assert.equal(lineages[0].dataOnly, true);
assert.equal(lineages[0].historicalOnly, true);
assert.equal(lineages[0].productionEligible, false);
assert.equal(lineages[0].authorityTransferred, false);
assert.equal(Object.hasOwn(lineages[0], 'runner'), false);
assert.equal(Object.hasOwn(lineages[0], 'harness'), false);
assert.equal(Object.hasOwn(lineages[0], 'actionReport'), false);
assert.equal(Object.hasOwn(lineages[0], 'promotionAuthority'), false);

console.log(
  `FLUID_ADVERSARIAL_LINEAGE_LEDGER_OK kind=${record.kind} lineages=${lineages.length} `
  + `cases=${lineages[0].attemptedCases}/${lineages[0].eligibleCases} `
  + `weaknesses=${lineages[0].weaknessesExposed} restoredTrusted=`
  + `${isTrustedAdversarialLineageReport(lineages[0])} frozen=true dataOnly=${lineages[0].dataOnly} `
  + `historicalOnly=${lineages[0].historicalOnly} authoritySuppressed=true`
);
