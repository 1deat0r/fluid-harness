import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  buildReplayFairnessFixture
} from './fixtures/harness-factory-proposal-replay-fairness.mjs';

const scenario = buildReplayFairnessFixture('harness-factory-proposal-replay-fairness-boundary');
const [oldest, middle] = scenario.batches;
const executionOptions = (proposalReport) => ({
  proposalReport,
  plannerCandidates: [scenario.failingPlannerCandidate],
  cases: [scenario.evaluationCase],
  ...scenario.budgets
});
const initial = scenario.replayItems();
const initialSequences = initial.map((item) => item.archive.sequence);
const oldestTarget = initial[0];
const stalePlan = scenario.replayPlans()[0];
const beforeRejected = scenario.ledger.serialize();

assert.throws(
  () => scenario.factory.executeArchivedProposalReplayResearch({
    ...oldestTarget,
    benchmark: {
      ...oldestTarget.benchmark,
      replayAttemptCount: 9
    }
  }, executionOptions(oldest)),
  /exact agenda item|stale|invalid shape/
);
assert.throws(
  () => scenario.factory.executeArchivedProposalReplayResearch(oldestTarget, {
    ...executionOptions(oldest),
    get goal() {
      return 'accessor-bearing goal';
    }
  }),
  /enumerable data properties|accessor/
);
assert.throws(
  () => scenario.factory.executeArchivedProposalReplayResearch(oldestTarget, executionOptions(middle)),
  /does not match the target|inconsistent/
);
assert.equal(scenario.ledger.serialize(), beforeRejected);
assert.deepEqual(scenario.replayItems().map((item) => item.archive.sequence), initialSequences);

assert.equal(scenario.attempt(oldest).status, 'REJECTED');
assert.throws(
  () => scenario.factory.executeResearchPlan(stalePlan, executionOptions(oldest)),
  /research plan is stale/
);
const afterAttempt = scenario.ledger.serialize();
assert.deepEqual(
  scenario.replayItems().map((item) => item.archive.sequence),
  [middle.archive.sequence, scenario.batches[2].archive.sequence, oldest.archive.sequence]
);

const tampered = JSON.parse(afterAttempt);
tampered.records[0].payload.proposals[0].architectureFingerprint = 'forged-fingerprint';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash verification failed|invalid shape|is invalid/
);
assert.equal(scenario.ledger.serialize(), afterAttempt);
assert.equal(scenario.ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_FAIRNESS_BOUNDARY_OK `
  + `forgedAttemptsRejected=true stalePlanRejected=true foreignBatchRejected=true `
  + `accessorRejected=true tamperedArchiveRejected=true `
  + `orderPreserved=${scenario.replayItems().map((item) => item.archive.sequence).join('>')} `
  + `ledgerEntries=${scenario.ledger.length} verify=${scenario.ledger.verify()}`
);
