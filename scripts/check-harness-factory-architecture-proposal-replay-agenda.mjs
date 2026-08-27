import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES,
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryResearchAgendaReport,
  isTrustedHarnessFactoryResearchPlanReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-agenda',
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

const emptyAgenda = factory.researchAgenda();
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(emptyAgenda), true);
assert.equal(
  emptyAgenda.items.some((item) => item.target === REPLAY),
  false
);
const emptyPlan = factory.researchPlan();
assert.equal(isTrustedHarnessFactoryResearchPlanReport(emptyPlan), true);
assert.equal(emptyPlan.plans.length, 0);

factory.manufacture({
  goal: 'create a generation that still needs holdout validation',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
const batch = factory.proposeArchitectures({
  goal: 'archive a batch that the agenda should surface',
  plannerCandidates: [plannerCandidate],
  archive: true
});

const agenda = factory.researchAgenda();
const item = agenda.items.find((candidate) => candidate.target === REPLAY);
assert.notEqual(item, undefined);
assert.equal(agenda.items[0].target !== REPLAY, true);
assert.equal(agenda.items[0].target, HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT);
assert.equal(agenda.items.indexOf(item) + 1, item.rank);
assert.equal(item.priority < agenda.items[0].priority, true);
assert.equal(item.priority, 190);
assert.equal(item.generation, null);
assert.equal(item.validationArchive, null);
assert.equal(item.factoryId, factory.factoryId);
assert.equal(item.id, `harness-factory-research:${REPLAY}:${batch.archive.sequence}`);
assert.deepEqual(item.archive, batch.archive);
assert.equal(item.archive.kind, 'harness-factory-architecture-proposals');
assert.equal(item.holdoutStatus, 'NOT_RUN');
assert.equal(item.benchmark.conversionStatus, 'UNTESTED');
assert.equal(item.benchmark.proposalCount, batch.proposalCount);
assert.equal(item.benchmark.novelProposalCount, batch.novelProposalCount);
assert.equal(item.benchmark.repeatedProposalCount, batch.repeatedProposalCount);
assert.equal(item.benchmark.untestedFingerprintCount, 1);
assert.deepEqual(item.benchmark.proposalArchive, batch.archive);
assert.equal(item.fitness.measured, false);
assert.equal(item.fitness.evaluatedArchitectureCount, 0);
assert.equal(item.fitness.replayed, false);
assert.equal(item.fitness.untestedArchitectureCount, 1);
assert.equal(item.dataOnly, true);
assert.equal(item.authorityTransferred, false);
assert.equal(Object.isFrozen(item), true);
for (const forbidden of ['candidate', 'candidates', 'planner', 'runner', 'actionReport', 'proposals']) {
  assert.equal(Object.hasOwn(item, forbidden), false, `${forbidden} leaked into the agenda`);
  assert.equal(Object.hasOwn(item.benchmark, forbidden), false);
  assert.equal(Object.hasOwn(item.fitness, forbidden), false);
}

const plan = factory.researchPlan();
const planItem = plan.plans.find((candidate) => candidate.target === REPLAY);
assert.notEqual(planItem, undefined);
assert.equal(planItem.bridge, HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.ARCHIVED_PROPOSAL_REPLAY);
assert.equal(planItem.executionMethod, 'factory.executeArchivedProposalReplayResearch');
assert.equal(planItem.agendaItemId, item.id);
assert.equal(planItem.generation, null);
assert.deepEqual(planItem.archive, batch.archive);
assert.equal(planItem.authorityTransferred, false);
assert.equal(planItem.requiredInputs.includes('the exact archived proposal batch named by that item'), true);
assert.equal(
  planItem.expectedEvidence.includes('a new archived generation that cites the source proposal batch'),
  true
);

const secondBatch = factory.proposeArchitectures({
  goal: 'archive a second untested batch',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const widened = factory.researchAgenda();
const replayItems = widened.items.filter((candidate) => candidate.target === REPLAY);
assert.equal(replayItems.length, 2);
assert.equal(
  new Set(replayItems.map(({ id }) => id)).size,
  2
);
assert.deepEqual(
  replayItems.map(({ archive }) => archive.sequence).sort((left, right) => left - right),
  [batch.archive.sequence, secondBatch.archive.sequence]
);
const stableLedger = ledger.serialize();
factory.researchAgenda();
factory.researchPlan();
factory.researchAgenda({ maxItems: 1 });
assert.equal(ledger.serialize() === stableLedger, true, 'agenda or plan reads mutated the ledger');
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_AGENDA_OK `
  + `replayItems=${replayItems.length} priority=${item.priority} `
  + `firstTarget=${agenda.items[0].target} bridge=${planItem.bridge} `
  + `conversionStatus=${item.benchmark.conversionStatus} measured=${item.fitness.measured} `
  + `ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
