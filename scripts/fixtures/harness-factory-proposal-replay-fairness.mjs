import { buildHarnessFactoryFixture } from './harness-factory.mjs';

export const REPLAY_ARCHIVED_PROPOSALS = 'REPLAY_ARCHIVED_PROPOSALS';

export function buildReplayFairnessFixture(prefix) {
  const fixture = buildHarnessFactoryFixture({
    prefix,
    includeResearch: false,
    proposalExportName: 'proposeArchitectureDirect',
    includeFailingPlanner: true
  });
  const batches = ['oldest', 'middle', 'youngest'].map((label) =>
    fixture.factory.proposeArchitectures({
      goal: `${label} archived design awaiting a fair replay turn`,
      plannerCandidates: [fixture.failingPlannerCandidate],
      archive: true
    }));
  const replayItems = (options = {}) => fixture.factory.researchAgenda(options).items.filter(
    (item) => item.target === REPLAY_ARCHIVED_PROPOSALS
  );
  const replayPlans = (options = {}) => fixture.factory.researchPlan(options).plans.filter(
    (plan) => plan.target === REPLAY_ARCHIVED_PROPOSALS
  );
  const attempt = (batch) => fixture.factory.manufactureFromArchivedProposals(batch, {
    plannerCandidates: [fixture.failingPlannerCandidate],
    cases: [fixture.evaluationCase],
    ...fixture.budgets
  });
  return {
    ...fixture,
    batches,
    replayItems,
    replayPlans,
    attempt
  };
}
