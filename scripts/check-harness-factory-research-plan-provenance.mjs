import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function holdoutBudgets() {
  return {
    holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

function reconstructedCandidate(fixture, recommendation) {
  return new AgentArchitectureCandidate({
    id: recommendation.baseline.architecture.architectureId,
    description: 'candidate for research-plan provenance checks',
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: recommendation.baseline.architecture.components
  });
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-provenance',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
fixture.factory.manufacture({
  goal: 'create a prior archive for provenance checks',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const plan = fixture.factory.researchPlan().plans[0];
const receipt = fixture.factory.executeResearchPlanReceipt(plan, {
  candidate: reconstructedCandidate(fixture, fixture.factory.recommend()),
  holdoutCases: [fixture.holdoutCase],
  ...holdoutBudgets()
});

assert.deepEqual(receipt.resultArchiveSequences.length, 1);
assert.equal(receipt.resultArchiveSequences[0] < receipt.archive.sequence, true);
assert.deepEqual(
  receipt.resultArchiveLocators.map(({ sequence }) => sequence),
  receipt.resultArchiveSequences
);
const resultArchive = fixture.ledger.records.find(
  ({ sequence }) => sequence === receipt.resultArchiveSequences[0]
);
assert.notEqual(resultArchive, undefined);
assert.equal(resultArchive.kind, 'harness-factory-validation');
assert.deepEqual(receipt.resultArchiveLocators[0], {
  kind: resultArchive.kind,
  sequence: resultArchive.sequence,
  hash: resultArchive.hash
});
assert.equal(fixture.ledger.verify(), true);

const restored = EvidenceLedger.fromSerialized(fixture.ledger.serialize());
assert.equal(restored.verify(), true);
assert.deepEqual(
  restored.restoreHarnessFactoryResearchPlanExecutions(),
  fixture.ledger.restoreHarnessFactoryResearchPlanExecutions()
);

console.log(
  `FLUID_HARNESS_FACTORY_RESEARCH_PLAN_PROVENANCE_OK `
  + `resultType=${receipt.resultType} resultSequence=${resultArchive.sequence} `
  + `resultKind=${resultArchive.kind} receiptSequence=${receipt.archive.sequence} `
  + `locatorBound=true prior=true verified=${restored.verify()}`
);
