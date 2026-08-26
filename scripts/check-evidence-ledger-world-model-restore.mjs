import assert from 'node:assert/strict';

import {
  ConstitutionalCore,
  Constitution
} from '../src/constitution.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  EvidenceLedger,
  isTrustedEvidenceLedger
} from '../src/evidence-ledger.mjs';
import {
  FluidHarness,
  isTrustedActionReport
} from '../src/harness.mjs';

const sourceCore = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 4 })
});
const sourcePlan = sourceCore.plan({
  id: 'ledger-world-model-source',
  description: 'Find a graph path'
});
const sourceReport = sourceCore.execute({
  plan: sourcePlan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});

const ledger = new EvidenceLedger();
ledger.appendAction(sourceReport);
ledger.appendCore(sourceCore);
const serialized = ledger.serialize();
const restoredLedger = EvidenceLedger.fromSerialized(serialized);

assert.equal(isTrustedEvidenceLedger(restoredLedger), true);
assert.equal(restoredLedger.verify(), true);
const restoredModel = restoredLedger.restoreWorldModel();
assert.equal(restoredModel.history.length, 1);
assert.equal(restoredModel.profile('graph-algorithms').attempts, 1);
assert.equal(restoredModel.profile('graph-algorithms').provenCases, 1);
assert.equal(restoredLedger.records[0].payload.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(isTrustedActionReport(restoredLedger.records[0].payload), false);

const resumedHarness = new FluidHarness({ worldModel: restoredModel });
const resumedCore = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 4 }),
  harness: resumedHarness
});
assert.equal(resumedCore.status.actionsUsed, 0);
assert.equal(resumedCore.auditTrail.length, 0);

const resumedPlan = resumedCore.plan({
  id: 'ledger-world-model-resumed',
  description: 'Find a graph path'
});
assert.equal(resumedPlan.strategyProfile.attempts, 1);
assert.ok(resumedPlan.prediction.expectedLikelihood > 0.8);

const resumedReport = resumedCore.execute({
  plan: resumedPlan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});
assert.equal(isTrustedActionReport(resumedReport, resumedHarness), true);
assert.equal(resumedReport.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(resumedCore.status.actionsUsed, 1);
assert.equal(resumedCore.learningHistory.length, 1);

const tampered = serialized.replace('ledger-world-model-source', 'ledger-world-model-tampered');
assert.throws(
  () => EvidenceLedger.fromSerialized(tampered).restoreWorldModel(),
  /hash verification failed/
);

console.log(
  `FLUID_EVIDENCE_LEDGER_WORLD_MODEL_RESTORE_OK history=${restoredModel.history.length} `
  + `priorAttempts=${resumedPlan.strategyProfile.attempts} freshProof=${resumedReport.evidence} `
  + `freshCoreActions=${resumedCore.status.actionsUsed}`
);
