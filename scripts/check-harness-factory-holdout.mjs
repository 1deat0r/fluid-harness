import assert from 'node:assert/strict';

import { AgentArchitectureAdoptionAuthority } from '../src/agent-architecture.mjs';
import {
  HARNESS_FACTORY_HOLDOUT_STATUSES,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-holdout',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includeFailingPlanner: true
});
const {
  factory,
  ledger,
  plannerCandidates,
  evaluationCase,
  holdoutCase,
  budgets
} = fixture;

const first = factory.manufacture({
  goal: 'record a rejected candidate before holdout validation',
  plannerCandidates,
  cases: [evaluationCase],
  holdoutCases: [holdoutCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(first), true);
assert.equal(first.status, 'REJECTED');
assert.equal(first.holdoutRequested, true);
assert.equal(first.holdout, null);
assert.equal(first.holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN);
assert.equal(first.factoryMetadata.holdout, undefined);
assert.equal(first.frontier.frontier[0].holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN);
assert.equal(ledger.length, 1);

const second = factory.improve({
  goal: 'adopt a candidate only after unseen holdout validation',
  plannerCandidates,
  cases: [evaluationCase],
  holdoutCases: [holdoutCase],
  ...budgets,
  memoryQuery: {
    source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
    keywords: ['rejected']
  }
});
assert.equal(isTrustedHarnessFactoryReport(second), true);
assert.equal(second.status, 'ADOPTED');
assert.equal(second.holdoutRequested, true);
assert.equal(second.holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED);
assert.equal(second.holdout.passed, true);
assert.equal(second.holdout.architectureId, second.adoptedCandidateId);
assert.deepEqual(second.holdout.caseIds, [holdoutCase.id]);
assert.equal(second.holdout.caseCount, 1);
assert.equal(second.holdout.attemptedCases, 1);
assert.equal(second.holdout.successes, 1);
assert.equal(second.holdout.successRate, 1);
assert.equal(second.holdout.proofEligibleCases, 1);
assert.equal(second.holdout.proven, 1);
assert.equal(second.holdout.provenRate, 1);
assert.equal(second.holdout.primaryComplete, true);
assert.equal(second.holdout.reproductionComplete, true);
assert.equal(second.holdout.reproducible, true);
assert.equal(second.holdout.complete, true);
assert.equal(second.holdout.independent, true);
assert.deepEqual(second.holdout.reproducibilityReasons, []);
assert.equal(second.holdout.dataOnly, true);
assert.equal(second.holdout.authorityTransferred, false);
assert.equal(second.frontier.frontier[0].holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED);
assert.equal(second.factoryMetadata.holdout.passed, true);
assert.deepEqual(second.factoryMetadata.holdout.caseIds, [holdoutCase.id]);
assert.equal(second.factoryMetadata.holdout.successRate, 1);
assert.equal(second.factoryMetadata.holdout.proven, 1);
assert.equal(second.factoryMetadata.holdout.dataOnly, true);
assert.equal(second.factoryMetadata.holdout.authorityTransferred, false);
assert.equal(second.archive.sequence, 2);
assert.equal(ledger.length, 2);
assert.equal(ledger.verify(), true);

const restored = ledger.restoreArchitectureDiscoveries();
assert.equal(restored.length, 2);
assert.equal(restored[1].factory.holdout.passed, true);
assert.deepEqual(restored[1].factory.holdout.caseIds, [holdoutCase.id]);
assert.equal(restored[1].factory.holdout.reproducible, true);
assert.equal(restored[1].factory.holdout.authorityTransferred, false);

const memory = memoryFromLedger({
  ledger: EvidenceLedger.fromSerialized(ledger.serialize()),
  maxEntries: 8,
  idPrefix: 'harness-factory-holdout-memory'
});
const holdoutMemory = buildStructuredMemoryContext({
  memory,
  query: {
    source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
    keywords: ['holdout-passed']
  }
});
assert.equal(holdoutMemory.resultCount, 1);
assert.equal(holdoutMemory.results[0].source, MEMORY_SOURCES.ARCHITECTURE_DISCOVERY);
assert.equal(holdoutMemory.results[0].keywords.includes('holdout-passed'), true);
assert.equal(holdoutMemory.results[0].historicalOnly, true);
assert.equal(holdoutMemory.results[0].dataOnly, true);
assert.equal(Object.hasOwn(holdoutMemory.results[0], 'authorityTransferred'), false);
const proposal = fixture.proposalRunner.propose({
  goal: 'use holdout outcome as a historical proposal signal',
  plannerCandidateIds: plannerCandidates.map(({ id }) => id),
  researchContext: holdoutMemory
});
assert.equal(proposal.proposals[0].components.priorHoldoutStatus, 'passed');
assert.equal(proposal.proposals[0].components.researchSource, 'STRUCTURED_MEMORY');

const failureFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-holdout-failure-learning',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includePartialPlanner: true,
  adoptionAuthority: new AgentArchitectureAdoptionAuthority({
    minimumProductionSuccessRate: 0.5,
    minimumProductionProvenRate: 0.5,
    minimumResearchSuccessRate: 0.5,
    minimumResearchProvenRate: 0.5,
    minimumSkepticSuccessRate: 0,
    minimumTransferSuccessRate: 0
  })
});
assert.throws(
  () => failureFixture.factory.manufacture({
    goal: 'retain a failed holdout as historical evidence',
    plannerCandidates: [failureFixture.partialPlannerCandidate],
    cases: [failureFixture.evaluationCase],
    holdoutCases: [failureFixture.secondEvaluationCase],
    ...failureFixture.budgets
  }),
  /holdout benchmark rejected/
);
assert.equal(failureFixture.ledger.length, 1);
assert.equal(failureFixture.ledger.verify(), true);
const failedArchive = failureFixture.ledger.restoreArchitectureDiscoveries()[0];
assert.equal(failedArchive.factory.status, 'REJECTED');
assert.equal(failedArchive.factory.holdout.passed, false);
assert.equal(failedArchive.factory.holdout.complete, false);
assert.equal(failedArchive.factory.holdout.reproducible, false);
assert.equal(failedArchive.factory.holdout.authorityTransferred, false);
const failedFrontier = failureFixture.factory.frontier();
assert.equal(failedFrontier.frontier[0].holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED);
assert.equal(failedFrontier.frontier[0].status, 'REJECTED');
const failedMemory = memoryFromLedger({
  ledger: EvidenceLedger.fromSerialized(failureFixture.ledger.serialize()),
  maxEntries: 8,
  idPrefix: 'harness-factory-holdout-failure-memory'
});
const failedMemoryContext = buildStructuredMemoryContext({
  memory: failedMemory,
  query: {
    source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
    keywords: ['holdout-failed']
  }
});
assert.equal(failedMemoryContext.resultCount, 1);
assert.equal(failedMemoryContext.results[0].keywords.includes('rejected'), true);
assert.equal(failedMemoryContext.results[0].keywords.includes('holdout-failed'), true);
assert.equal(failedMemoryContext.results[0].historicalOnly, true);
assert.equal(failedMemoryContext.results[0].dataOnly, true);
assert.equal(Object.hasOwn(failedMemoryContext.results[0], 'holdout'), false);
const failedProposal = failureFixture.proposalRunner.propose({
  goal: 'learn from the failed holdout without receiving its artifacts',
  plannerCandidateIds: [failureFixture.partialPlannerCandidate.id],
  researchContext: failedMemoryContext
});
assert.equal(failedProposal.proposals[0].components.priorHoldoutStatus, 'failed');

const multiFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-holdout-multi-case',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const multiCase = multiFixture.factory.manufacture({
  goal: 'validate a complete two-case holdout suite',
  plannerCandidates: [multiFixture.plannerCandidate],
  cases: [multiFixture.evaluationCase],
  holdoutCases: [multiFixture.holdoutCase, multiFixture.secondEvaluationCase],
  ...multiFixture.budgets,
  holdoutProductionBudget: new EvaluationBudget({ maxCases: 2 }),
  holdoutResearchBudget: new EvaluationBudget({ maxCases: 2 }),
  holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(multiCase.status, 'ADOPTED');
assert.equal(multiCase.holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED);
assert.equal(multiCase.holdout.caseCount, 2);
assert.equal(multiCase.holdout.attemptedCases, 2);
assert.equal(multiCase.holdout.successes, 2);
assert.equal(multiCase.holdout.successRate, 1);
assert.equal(multiCase.holdout.proofEligibleCases, 2);
assert.equal(multiCase.holdout.proven, 2);
assert.equal(multiCase.holdout.provenRate, 1);
assert.equal(multiCase.holdout.complete, true);
assert.equal(multiFixture.ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_HOLDOUT_OK `
  + `first=${first.status} second=${second.status} `
  + `cases=${second.holdout.caseCount} successes=${second.holdout.successes} `
  + `proven=${second.holdout.proven} reproducible=${second.holdout.reproducible} `
  + `independent=${second.holdout.independent} archived=${restored[1].factory.holdout.passed} `
  + `memorySignal=${proposal.proposals[0].components.priorHoldoutStatus} `
  + `failedArchived=${failedArchive.factory.holdout.passed === false} `
  + `failedMemorySignal=${failedProposal.proposals[0].components.priorHoldoutStatus} `
  + `multiCases=${multiCase.holdout.caseCount} multiProven=${multiCase.holdout.proven} `
  + `authorityTransferred=${second.holdout.authorityTransferred}`
);
