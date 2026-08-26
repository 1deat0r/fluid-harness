import assert from 'node:assert/strict';

import {
  ConstitutionalCore,
  Constitution
} from '../src/constitution.mjs';
import { questionFor } from '../src/curiosity.mjs';
import {
  EvidenceLedger,
  isTrustedEvidenceLedger
} from '../src/evidence-ledger.mjs';
import { isTrustedActionReport } from '../src/harness.mjs';

const core = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2, maxAuditEntries: 16 })
});
const plan = core.plan({
  id: 'research-queue-archive-action',
  description: 'Find a graph path'
});
const report = core.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [],
    start: 'A',
    goal: 'B'
  }
});
const question = questionFor({ actionReport: report });
assert.equal(question.researchRequired, true);
core.recordQuestion({
  taskId: plan.task.id,
  question,
  actionReport: report
});

const ledger = new EvidenceLedger();
ledger.appendCore(core);
const serialized = ledger.serialize();
const restored = EvidenceLedger.fromSerialized(serialized);
const queue = restored.restoreResearchQueue();

assert.equal(isTrustedEvidenceLedger(restored), true);
assert.equal(restored.verify(), true);
assert.equal(queue.length, 1);
assert.equal(queue[0].taskId, plan.task.id);
assert.equal(queue[0].researchRequired, true);
assert.equal(Object.isFrozen(queue[0]), true);
assert.equal(isTrustedActionReport(queue[0]), false);
assert.equal(JSON.stringify(queue).includes('function'), false);
assert.deepEqual(new EvidenceLedger().restoreResearchQueue(), []);

const tampered = serialized.replace('research-queue-archive-action', 'research-queue-archive-tampered');
assert.throws(
  () => EvidenceLedger.fromSerialized(tampered).restoreResearchQueue(),
  /hash verification failed/
);

console.log(
  `FLUID_RESEARCH_QUEUE_ARCHIVE_OK pending=${queue.length} verified=${restored.verify()} `
  + `trustedAction=${isTrustedActionReport(queue[0])} freshAuthority=false`
);
