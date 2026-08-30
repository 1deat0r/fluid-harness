import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_RESEARCH_TARGETS,
  MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-exhaustion',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect',
  includeFailingPlanner: true
});
const { factory, ledger, failingPlannerCandidate, evaluationCase, budgets } = fixture;
const batch = factory.proposeArchitectures({
  goal: 'archive one design with a bounded failing replay lifecycle',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
const options = {
  proposalReport: batch,
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
};
const planForBatch = () => factory.researchPlan().plans.find(
  (plan) => plan.target === HARNESS_FACTORY_RESEARCH_TARGETS.REPLAY_ARCHIVED_PROPOSALS
    && plan.archive.sequence === batch.archive.sequence
);

assert.equal(MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS, 3);
const receipts = [];
for (let attempt = 1; attempt <= MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS; attempt += 1) {
  const plan = planForBatch();
  assert.notEqual(plan, undefined);
  const receipt = factory.executeResearchPlanReceipt(plan, options);
  receipts.push(receipt);
  assert.equal(receipt.resultStatus, 'REJECTED');
  const conversion = factory.architectureProposalConversion().batches[0];
  assert.equal(conversion.replayCount, attempt);
  assert.equal(
    conversion.replayAttemptsRemaining,
    MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS - attempt
  );
  assert.equal(receipt.targetResolved, attempt === MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS);
}

const exhausted = factory.architectureProposalConversion();
assert.equal(exhausted.exhaustedBatchCount, 1);
assert.equal(exhausted.replayedBatchCount, 1);
assert.equal(exhausted.batches[0].status, 'EXHAUSTED');
assert.equal(exhausted.batches[0].replayExhausted, true);
assert.equal(exhausted.batches[0].replayAttemptsRemaining, 0);
assert.equal(planForBatch(), undefined);
assert.deepEqual(receipts.map((receipt) => receipt.targetResolved), [false, false, true]);

const beforeFourth = ledger.serialize();
assert.throws(
  () => factory.manufactureFromArchivedProposals(batch, {
    plannerCandidates: [failingPlannerCandidate],
    cases: [evaluationCase],
    ...budgets
  }),
  /replay attempt limit is exhausted/
);
assert.equal(ledger.serialize(), beforeFourth);
assert.equal(factory.architectureProposalConversion().batches[0].replayCount, 3);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_EXHAUSTION_OK `
  + `limit=${MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS} `
  + `receipts=${receipts.length} resolved=${receipts.map((receipt) => receipt.targetResolved).join('+')} `
  + `status=${exhausted.batches[0].status} remaining=${exhausted.batches[0].replayAttemptsRemaining} `
  + `fourthRejected=true ledgerAtomic=true ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
