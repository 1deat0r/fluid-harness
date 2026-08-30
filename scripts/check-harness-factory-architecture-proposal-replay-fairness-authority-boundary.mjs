import assert from 'node:assert/strict';

import {
  buildReplayFairnessFixture
} from './fixtures/harness-factory-proposal-replay-fairness.mjs';

const scenario = buildReplayFairnessFixture(
  'harness-factory-proposal-replay-fairness-authority-boundary'
);
const [oldest] = scenario.batches;
const beforeReads = scenario.ledger.serialize();
const agenda = scenario.factory.researchAgenda();
const plan = scenario.factory.researchPlan();
assert.equal(scenario.ledger.serialize(), beforeReads);
assert.equal(agenda.dataOnly, true);
assert.equal(agenda.authorityTransferred, false);
assert.equal(plan.dataOnly, true);
assert.equal(plan.authorityTransferred, false);
assert.equal(
  agenda.items.every((item) => item.dataOnly === true && item.authorityTransferred === false),
  true
);

const forbidden = [
  'actionReport',
  'adoptedCandidate',
  'candidate',
  'candidates',
  'discoveryRunner',
  'plannerCandidates',
  'proposalReport',
  'runner'
];
const containsForbiddenKey = (value) => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  return Reflect.ownKeys(value).some((key) => forbidden.includes(key))
    || Reflect.ownKeys(value).some((key) => containsForbiddenKey(value[key]));
};
assert.equal(containsForbiddenKey(agenda), false);
assert.equal(containsForbiddenKey(plan), false);

assert.equal(scenario.attempt(oldest).status, 'REJECTED');
const conversion = scenario.factory.architectureProposalConversion();
const archived = scenario.ledger.restoreHarnessFactoryArchitectureProposals()[0];
assert.equal(conversion.convertedFingerprintCount, 0);
assert.equal(conversion.batches[0].untestedFingerprintCount, 1);
assert.equal(conversion.batches[0].replayCount, 1);
assert.equal(archived.evaluated, false);
assert.equal(archived.adopted, false);
assert.equal(archived.deployed, false);
assert.equal(archived.dataOnly, true);
assert.equal(archived.authorityTransferred, false);
assert.equal(
  scenario.replayItems().some((item) => item.archive.sequence === oldest.archive.sequence),
  true,
  'a failed turn remains unfinished even though it rotates behind untouched work'
);
assert.throws(
  () => scenario.factory.manufactureFromArchivedProposals(agenda.items[0], {
    plannerCandidates: [scenario.failingPlannerCandidate],
    cases: [scenario.evaluationCase],
    ...scenario.budgets
  }),
  /requires an exact archived report from this factory/
);
assert.equal(scenario.ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_FAIRNESS_AUTHORITY_BOUNDARY_OK `
  + `sourceEvaluated=${archived.evaluated} sourceAdopted=${archived.adopted} `
  + `sourceDeployed=${archived.deployed} converted=${conversion.convertedFingerprintCount} `
  + `untested=${conversion.batches[0].untestedFingerprintCount} retained=true `
  + `artifactsSuppressed=true dataOnly=${agenda.dataOnly} `
  + `authorityTransferred=${agenda.authorityTransferred} verify=${scenario.ledger.verify()}`
);
