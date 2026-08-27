import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_RECOMMENDATION_STATUSES,
  HARNESS_FACTORY_RESEARCH_TARGETS,
  HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const FORBIDDEN_KEYS = [
  'candidate',
  'candidates',
  'planner',
  'runner',
  'actionReport',
  'authority',
  'adoption',
  'discovery',
  'proposalReport',
  'ledger'
];

function collectKeys(value, found = []) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectKeys(entry, found);
    }
    return found;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (!found.includes(key)) {
        found.push(key);
      }
      collectKeys(value[key], found);
    }
  }
  return found;
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-authority',
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
  goal: 'keep the replay agenda advisory',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const beforeReads = ledger.serialize();
const agenda = factory.researchAgenda();
const plan = factory.researchPlan();
const recommendation = factory.recommend();
assert.equal(ledger.serialize() === beforeReads, true, 'advisory reads mutated the ledger');
assert.equal(
  agenda.items.some((item) => item.target === REPLAY),
  true
);
assert.equal(
  FORBIDDEN_KEYS.filter((key) => collectKeys(agenda.items).includes(key)).length,
  0
);
assert.equal(
  FORBIDDEN_KEYS.filter((key) => collectKeys(plan.plans).includes(key)).length,
  0
);
const item = agenda.items.find((candidate) => candidate.target === REPLAY);
const planItem = plan.plans.find((candidate) => candidate.target === REPLAY);
assert.equal(item.generation, null);
assert.equal(item.fitness.measured, false);
assert.equal(item.fitness.evaluatedArchitectureCount, 0);
assert.equal(item.authorityTransferred, false);
assert.equal(planItem.authorityTransferred, false);
assert.equal(planItem.bridge, HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.ARCHIVED_PROPOSAL_REPLAY);
assert.equal(recommendation.status, HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY);
assert.equal(factory.history().generations.length, 0);
assert.equal(batch.evaluated, false);
assert.equal(batch.adopted, false);

const report = factory.executeResearchPlan(planItem, {
  proposalReport: batch,
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(report.status, 'ADOPTED');
assert.equal(report.deployed, false);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(factory.history().generations.length, 1);
assert.equal(factory.history().generations[0].proposalArchive.sequence, batch.archive.sequence);
assert.equal(factory.history().generations[0].generation, 1);
assert.equal(factory.history().generations[0].status, 'ADOPTED');

const restoredBatch = ledger.restoreHarnessFactoryArchitectureProposals()[0];
assert.equal(restoredBatch.evaluated, false);
assert.equal(restoredBatch.adopted, false);
assert.equal(restoredBatch.deployed, false);
assert.equal(restoredBatch.dataOnly, true);
assert.equal(restoredBatch.authorityTransferred, false);

const cleared = factory.researchAgenda();
assert.equal(
  cleared.items.some((candidate) => candidate.target === REPLAY),
  false
);
assert.equal(
  cleared.items.some(
    (candidate) => candidate.target === HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT
  ),
  true
);
assert.equal(
  factory.recommend().status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_AUTHORITY_BOUNDARY_OK `
  + `artifactKeys=0 measured=${item.fitness.measured} advisoryOnlyRecommend=${recommendation.status} `
  + `freshAdopted=${report.status} freshDeployed=${report.deployed} sourceEvaluated=${restoredBatch.evaluated} `
  + `sourceAdopted=${restoredBatch.adopted} generations=${factory.history().generations.length} `
  + `postRecommend=${factory.recommend().status} ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
