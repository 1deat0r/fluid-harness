import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES,
  HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES,
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryArchitectureProposalReport,
  isTrustedHarnessFactoryReport,
  isTrustedHarnessFactoryResearchPlanExecutionHistoryReport,
  isTrustedHarnessFactoryResearchPlanExecutionReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-execution',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const {
  factory,
  ledger,
  plannerCandidate,
  evaluationCase,
  budgets
} = fixture;
const REPLAY = HARNESS_FACTORY_RESEARCH_TARGETS.REPLAY_ARCHIVED_PROPOSALS;

const batch = factory.proposeArchitectures({
  goal: 'dispatch an archived proposal batch through its own research plan',
  plannerCandidates: [plannerCandidate],
  archive: true
});
assert.equal(isTrustedHarnessFactoryArchitectureProposalReport(batch), true);
const agenda = factory.researchAgenda();
const item = agenda.items.find((candidate) => candidate.target === REPLAY);
assert.notEqual(item, undefined);
const plan = factory.researchPlan();
const planItem = plan.plans.find((candidate) => candidate.target === REPLAY);
assert.notEqual(planItem, undefined);
assert.equal(planItem.bridge, HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.ARCHIVED_PROPOSAL_REPLAY);
assert.equal(ledger.length, 1);

const receipt = factory.executeResearchPlanReceipt(planItem, {
  proposalReport: batch,
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryResearchPlanExecutionReport(receipt), true);
assert.equal(receipt.factoryId, factory.factoryId);
assert.equal(receipt.target, REPLAY);
assert.equal(receipt.bridge, HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.ARCHIVED_PROPOSAL_REPLAY);
assert.equal(receipt.executionMethod, 'factory.executeArchivedProposalReplayResearch');
assert.equal(receipt.resultType, HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.FACTORY_REPORT);
assert.equal(receipt.resultStatus, 'ADOPTED');
assert.equal(receipt.targetResolved, true);
assert.equal(receipt.completed, true);
assert.equal(receipt.archived, true);
assert.equal(receipt.archive.kind, 'harness-factory-research-plan-execution');
assert.equal(receipt.resultArchiveLocators.length, 1);
assert.equal(receipt.resultArchiveLocators[0].kind, 'architecture-discovery');
assert.deepEqual(receipt.resultArchiveSequences, [receipt.resultArchiveLocators[0].sequence]);

const report = receipt.result;
assert.equal(isTrustedHarnessFactoryReport(report), true);
assert.equal(report.status, 'ADOPTED');
assert.equal(report.complete, true);
assert.equal(report.reproducible, true);
assert.equal(report.freshAdoption, true);
assert.equal(report.deployed, false);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(report.generation, 1);
assert.deepEqual(report.proposalArchive, batch.archive);
assert.deepEqual(report.factoryMetadata.proposalArchive, batch.archive);

const clearedAgenda = factory.researchAgenda();
assert.equal(
  clearedAgenda.items.some((candidate) => candidate.target === REPLAY),
  false
);
const conversion = factory.architectureProposalConversion();
assert.equal(conversion.batches.length, 1);
assert.equal(conversion.batches[0].status, 'REPLAYED');
assert.equal(conversion.batches[0].replayed, true);
assert.equal(conversion.batches[0].untestedFingerprintCount, 0);

const history = factory.researchPlanExecutions();
assert.equal(isTrustedHarnessFactoryResearchPlanExecutionHistoryReport(history), true);
assert.equal(history.executions.length, 1);
assert.equal(history.executions[0].target, REPLAY);
assert.equal(history.executions[0].bridge, HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.ARCHIVED_PROPOSAL_REPLAY);
assert.equal(history.executions[0].resultType, HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.FACTORY_REPORT);
assert.equal(history.executions[0].dataOnly, true);
assert.equal(history.executions[0].authorityTransferred, false);
assert.equal(Object.isFrozen(history.executions[0]), true);

const compatibility = factory.executeResearchPlan;
assert.equal(typeof compatibility === 'function', true);
const secondBatch = factory.proposeArchitectures({
  goal: 'replay a second batch through the result-returning bridge',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const secondPlan = factory.researchPlan().plans.find(
  (candidate) => candidate.target === REPLAY
);
assert.notEqual(secondPlan, undefined);
const secondReport = factory.executeResearchPlan(secondPlan, {
  proposalReport: secondBatch,
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(secondReport), true);
assert.equal(secondReport.generation, 2);
assert.deepEqual(secondReport.proposalArchive, secondBatch.archive);
assert.equal(factory.researchPlanExecutions().executions.length, 2);
assert.equal(ledger.length, 6);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_EXECUTION_OK `
  + `bridge=${receipt.bridge} result=${receipt.resultType}:${receipt.resultStatus} `
  + `resolved=${receipt.targetResolved} generation=${report.generation} `
  + `citedBatch=${report.proposalArchive.sequence} receipts=${factory.researchPlanExecutions().executions.length} `
  + `conversion=${conversion.batches[0].status} ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
