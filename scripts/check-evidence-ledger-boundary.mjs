import assert from 'node:assert/strict';

import {
  ConstitutionalCore
} from '../src/constitution.mjs';
import {
  CognitiveCycleRunner,
  isTrustedCycleReport
} from '../src/cycle.mjs';
import {
  EvidenceLedger,
  EVIDENCE_LEDGER_FORMAT,
  isTrustedEvidenceLedger
} from '../src/evidence-ledger.mjs';
import {
  FluidHarness,
  isTrustedActionReport
} from '../src/harness.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'evidence-ledger-action',
  description: 'Find a graph path'
});
const actionReport = harness.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});

const core = new ConstitutionalCore();
const corePlan = core.plan({
  id: 'evidence-ledger-core',
  description: 'Find a graph path'
});
core.execute({
  plan: corePlan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});

const cycle = new CognitiveCycleRunner().run({
  task: {
    id: 'evidence-ledger-cycle',
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});

const ledger = new EvidenceLedger();
const actionEntry = ledger.appendAction(actionReport);
const cycleEntry = ledger.appendCycle(cycle);
const coreEntry = ledger.appendCore(core);

assert.equal(isTrustedEvidenceLedger(ledger), true);
assert.equal(ledger.length, 3);
assert.equal(actionEntry.kind, 'action');
assert.equal(actionEntry.payload.evidence, 'PROVEN');
assert.equal(cycleEntry.kind, 'cycle');
assert.equal(coreEntry.kind, 'core');
assert.equal(ledger.verify(), true);
assert.equal(Object.isFrozen(actionEntry), true);
assert.equal(Object.isFrozen(actionEntry.payload), true);

const serialized = ledger.serialize();
const restored = EvidenceLedger.fromSerialized(serialized);
assert.equal(isTrustedEvidenceLedger(restored), true);
assert.equal(restored.verify(), true);
assert.deepEqual(restored.records, ledger.records);
assert.equal(restored.serialize(), serialized);
assert.equal(isTrustedActionReport(restored.records[0].payload), false);
assert.equal(isTrustedCycleReport(restored.records[1].payload), false);

const tampered = JSON.parse(serialized);
tampered.records[0].payload.evidence = 'OBSERVED';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash verification failed/
);

const reordered = JSON.parse(serialized);
reordered.records.reverse();
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(reordered)),
  /sequence|previous hash|hash verification/i
);

assert.throws(
  () => ledger.appendAction(Object.freeze({ ...actionReport })),
  /trusted action report/
);
assert.equal(
  EvidenceLedger.fromSerialized(JSON.stringify({
    format: EVIDENCE_LEDGER_FORMAT,
    records: []
  })).length,
  0
);

const spoofed = Object.create(EvidenceLedger.prototype);
assert.equal(isTrustedEvidenceLedger(spoofed), false);

console.log(`FLUID_EVIDENCE_LEDGER_OK entries=${restored.length} verified=${restored.verify()} roundTrip=${restored.serialize() === serialized}`);
