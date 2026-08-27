import assert from 'node:assert/strict';

import { AgentArchitectureAdoptionAuthority } from '../src/agent-architecture.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-holdout-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const {
  factory,
  ledger,
  plannerCandidate,
  evaluationCase,
  holdoutCase,
  secondEvaluationCase,
  budgets
} = fixture;

function validOptions(overrides = {}) {
  return {
    goal: 'holdout boundary check',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    holdoutCases: [holdoutCase],
    ...budgets,
    ...overrides
  };
}

assert.throws(
  () => factory.manufacture(validOptions({ holdoutCases: [evaluationCase] })),
  /disjoint from benchmark cases/
);
assert.throws(
  () => factory.manufacture(validOptions({ holdoutCases: [secondEvaluationCase, secondEvaluationCase] })),
  /case ids must be unique/
);
assert.throws(
  () => factory.manufacture(validOptions({ holdoutCases: [Object.freeze({ ...holdoutCase })] })),
  /trusted planner cases/
);
const accessorHoldout = {};
Object.defineProperty(accessorHoldout, 'length', {
  enumerable: true,
  get() {
    return 1;
  }
});
assert.throws(
  () => factory.manufacture(validOptions({ holdoutCases: accessorHoldout })),
  /holdoutCases must contain at least one case/
);
assert.throws(
  () => factory.manufacture(validOptions({
    holdoutProductionBudget: new EvaluationBudget({ maxCases: 0 })
  })),
  /positive integer/
);
assert.throws(
  () => factory.manufacture(validOptions({
    holdoutProductionBudget: Object.freeze({ maxCases: 1 })
  })),
  /trusted EvaluationBudget/
);
assert.throws(
  () => factory.manufacture(validOptions({
    holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutCases: [holdoutCase, secondEvaluationCase],
    holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  })),
  /holdoutProductionBudget must cover every eligible holdout case/
);
assert.equal(ledger.length, 0);

const failureFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-holdout-failure',
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
    goal: 'reject a candidate that fails the unseen holdout',
    plannerCandidates: [failureFixture.partialPlannerCandidate],
    cases: [failureFixture.evaluationCase],
    holdoutCases: [failureFixture.secondEvaluationCase],
    ...failureFixture.budgets
  }),
  /holdout benchmark rejected/
);
assert.equal(failureFixture.ledger.length, 1);
assert.equal(failureFixture.ledger.verify(), true);
const failureArchive = failureFixture.ledger.restoreArchitectureDiscoveries()[0];
assert.equal(failureArchive.factory.status, 'REJECTED');
assert.equal(failureArchive.factory.holdout.passed, false);
assert.equal(failureArchive.factory.holdout.dataOnly, true);
assert.equal(failureArchive.factory.holdout.authorityTransferred, false);
assert.equal(
  failureFixture.factory.frontier().frontier[0].holdoutStatus,
  'FAILED'
);

const noArchiveFailureFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-holdout-no-archive-failure',
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
  () => noArchiveFailureFixture.factory.manufacture({
    goal: 'reject a failed holdout without archival persistence',
    plannerCandidates: [noArchiveFailureFixture.partialPlannerCandidate],
    cases: [noArchiveFailureFixture.evaluationCase],
    holdoutCases: [noArchiveFailureFixture.secondEvaluationCase],
    ...noArchiveFailureFixture.budgets,
    archive: false
  }),
  /holdout benchmark rejected/
);
assert.equal(noArchiveFailureFixture.ledger.length, 0);
assert.equal(noArchiveFailureFixture.factory.frontiers().returnedBenchmarkCount, 0);
assert.equal(noArchiveFailureFixture.factory.history().returnedGenerationCount, 0);

const driftFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-holdout-drift',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includeFailingPlanner: true
});
driftFixture.factory.manufacture({
  goal: 'create a holdout identity baseline',
  plannerCandidates: driftFixture.plannerCandidates,
  cases: [driftFixture.evaluationCase],
  holdoutCases: [driftFixture.holdoutCase],
  ...driftFixture.budgets
});
assert.throws(
  () => driftFixture.factory.improve({
    goal: 'reject a changed holdout benchmark',
    plannerCandidates: driftFixture.plannerCandidates,
    cases: [driftFixture.evaluationCase],
    holdoutCases: [driftFixture.secondEvaluationCase],
    ...driftFixture.budgets,
    memoryQuery: { keywords: ['rejected'] }
  }),
  /benchmark contract changed/
);
assert.equal(driftFixture.ledger.length, 2);
assert.equal(driftFixture.ledger.verify(), true);
const driftRejections = driftFixture.ledger.restoreHarnessFactoryImprovementRejections();
assert.equal(driftRejections.length, 1);
assert.equal(driftRejections[0].improvement.benchmarkStable, false);
assert.equal(driftRejections[0].dataOnly, true);
assert.equal(driftRejections[0].authorityTransferred, false);
assert.equal(
  driftFixture.factory.improvementRejections().returnedRejectionCount,
  1
);

console.log(
  `FLUID_HARNESS_FACTORY_HOLDOUT_BOUNDARY_OK `
  + `overlapRejected=true duplicateRejected=true forgedRejected=true accessorRejected=true `
  + `budgetRejected=true capacityRejected=true holdoutFailureRejected=true `
  + `holdoutDriftRejected=true failureArchivedWithoutExposure=${failureFixture.ledger.length === 1}`
  + ` benchmarkDriftArchived=${driftFixture.ledger.length === 2}`
  + ` archiveDisabledFailureUnarchived=${noArchiveFailureFixture.ledger.length === 0}`
);
