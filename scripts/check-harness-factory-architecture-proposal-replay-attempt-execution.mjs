import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES,
  HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES,
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryResearchPlanExecutionReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const REPLAY = HARNESS_FACTORY_RESEARCH_TARGETS.REPLAY_ARCHIVED_PROPOSALS;
const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-attempt-execution',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect',
  includeFailingPlanner: true
});
const {
  factory,
  ledger,
  plannerCandidate,
  failingPlannerCandidate,
  evaluationCase,
  budgets
} = fixture;

const batch = factory.proposeArchitectures({
  goal: 'archive a design the first two replays will refuse to adopt',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
assert.equal(ledger.length, 1);

const firstPlan = factory.researchPlan().plans.find((plan) => plan.target === REPLAY);
assert.equal(firstPlan.bridge, HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.ARCHIVED_PROPOSAL_REPLAY);
assert.equal(firstPlan.executionMethod, 'factory.executeArchivedProposalReplayResearch');
const first = factory.executeResearchPlanReceipt(firstPlan, {
  proposalReport: batch,
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryResearchPlanExecutionReport(first), true);
assert.equal(first.target, REPLAY);
assert.equal(first.resultType, HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.FACTORY_REPORT);
assert.equal(first.resultStatus, 'REJECTED');
assert.equal(first.completed, true);
assert.equal(first.archived, true);
assert.equal(first.targetResolved, false);
assert.equal(isTrustedHarnessFactoryReport(first.result), true);
assert.equal(first.result.status, 'REJECTED');
assert.deepEqual(first.result.proposalArchive, batch.archive);
assert.equal(first.resultArchiveLocators.length, 1);
assert.equal(first.resultArchiveLocators[0].kind, 'architecture-discovery');

const requeued = factory.researchAgenda().items.find((item) => item.target === REPLAY);
assert.equal(requeued.benchmark.conversionStatus, 'REPLAYED');
assert.equal(requeued.benchmark.replayAttemptCount, 1);
assert.equal(ledger.length, 3);

const secondPlan = factory.researchPlan().plans.find((plan) => plan.target === REPLAY);
assert.deepEqual(secondPlan.archive, batch.archive);
const second = factory.executeResearchPlanReceipt(secondPlan, {
  proposalReport: batch,
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(second.resultStatus, 'REJECTED');
assert.equal(second.targetResolved, false);
assert.equal(second.agendaItemId, first.agendaItemId);
assert.equal(
  second.planId,
  first.planId,
  'one replay target keeps one experiment plan across attempts'
);
assert.notEqual(second.resultArchiveSequences[0], first.resultArchiveSequences[0]);
assert.deepEqual(
  factory.researchPlanExecutions().executions.map((execution) => execution.targetResolved),
  [false, false]
);
assert.equal(
  factory.researchAgenda().items.find((item) => item.target === REPLAY).benchmark
    .replayAttemptCount,
  2
);

const compatible = factory.executeResearchPlan(
  factory.researchPlan().plans.find((plan) => plan.target === REPLAY),
  {
    proposalReport: batch,
    plannerCandidates: [failingPlannerCandidate],
    cases: [evaluationCase],
    ...budgets
  }
);
assert.equal(isTrustedHarnessFactoryReport(compatible), true);
assert.equal(compatible.status, 'REJECTED');
assert.equal(factory.researchPlanExecutions().executions.length, 3);
assert.equal(
  factory.researchPlanExecutions().consideredExecutionCount,
  3
);
assert.equal(
  factory.researchPlanExecutions().executions.filter(
    (execution) => execution.targetResolved === false
  ).length,
  3
);
assert.equal(factory.architectureProposalConversion().batches[0].replayCount, 3);
assert.equal(factory.architectureProposalReplayOutcomes().adoptedReplayCount, 0);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_ATTEMPT_EXECUTION_OK `
  + `firstResolved=${first.targetResolved} firstStatus=${first.resultStatus} `
  + `attempts=${factory.researchPlanExecutions().executions.length} `
  + `sameItem=${second.agendaItemId === first.agendaItemId} `
  + `distinctGenerations=${new Set(factory.researchPlanExecutions().executions.flatMap((execution) => execution.resultArchiveSequences)).size} `
  + `replayCount=${factory.architectureProposalConversion().batches[0].replayCount} `
  + `adopted=${factory.architectureProposalReplayOutcomes().adoptedReplayCount} `
  + `queueStatus=${factory.researchAgenda().items.find((item) => item.target === REPLAY).benchmark.conversionStatus} `
  + `generations=${factory.history().generations.length} ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
