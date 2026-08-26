import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RECOMMENDATION_STATUSES,
  isTrustedHarnessFactoryValidationReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function reconstructedCandidate(fixture, recommendation) {
  return new AgentArchitectureCandidate({
    id: recommendation.baseline.architecture.architectureId,
    description: 'boundary-test reconstructed candidate',
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: recommendation.baseline.architecture.components
  });
}

function holdoutBudgets() {
  return {
    holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

function buildValidation(fixture) {
  fixture.factory.manufacture({
    goal: 'create a generation for validation archival boundaries',
    plannerCandidates: [fixture.plannerCandidate],
    cases: [fixture.evaluationCase],
    ...fixture.budgets
  });
  const recommendation = fixture.factory.recommend();
  assert.equal(
    recommendation.status,
    HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
  );
  return {
    recommendation,
    validation: fixture.factory.validateRecommendation(recommendation, {
      candidate: reconstructedCandidate(fixture, recommendation),
      holdoutCases: [fixture.holdoutCase],
      ...holdoutBudgets()
    })
  };
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-validation-archive-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { validation } = buildValidation(fixture);
assert.equal(validation.archive, null);
const forgedValidation = Object.freeze({ ...validation });
const proxiedValidation = new Proxy(validation, {});
assert.equal(isTrustedHarnessFactoryValidationReport(forgedValidation), false);
assert.equal(isTrustedHarnessFactoryValidationReport(proxiedValidation), false);
assert.throws(
  () => fixture.factory.archiveValidation(forgedValidation),
  /exact validation from this factory/
);
assert.throws(
  () => fixture.factory.archiveValidation(proxiedValidation),
  /exact validation from this factory/
);
assert.throws(
  () => fixture.ledger.appendHarnessFactoryValidation(forgedValidation),
  /trusted validation report/
);
assert.equal(fixture.ledger.length, 1);

const archived = fixture.factory.archiveValidation(validation);
assert.equal(archived.archived, true);
assert.throws(
  () => fixture.factory.archiveValidation(validation),
  /validation is stale/
);
assert.throws(
  () => fixture.factory.archiveValidation(archived),
  /already been archived/
);

const otherFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-validation-archive-boundary-other',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { validation: foreignValidation } = buildValidation(otherFixture);
assert.throws(
  () => fixture.factory.archiveValidation(foreignValidation),
  /exact validation from this factory/
);
assert.equal(fixture.ledger.length, 2);

const staleFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-validation-archive-boundary-stale',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { validation: staleValidation } = buildValidation(staleFixture);
staleFixture.factory.manufacture({
  goal: 'advance the validation archival baseline',
  plannerCandidates: [staleFixture.plannerCandidate],
  cases: [staleFixture.evaluationCase],
  ...staleFixture.budgets
});
assert.throws(
  () => staleFixture.factory.archiveValidation(staleValidation),
  /validation is stale/
);
assert.equal(staleFixture.ledger.length, 2);

const mutableFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-recommendation-validation-archive-boundary-mutable',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { validation: mutableValidation } = buildValidation(mutableFixture);
Object.defineProperty(mutableFixture.ledger, 'serialize', {
  configurable: true,
  value: () => mutableFixture.ledger.serialize()
});
assert.throws(
  () => mutableFixture.factory.archiveValidation(mutableValidation),
  /unmodified evidence ledger instance/
);
assert.equal(mutableFixture.ledger.length, 1);

const tampered = JSON.parse(fixture.ledger.serialize());
tampered.records[1].payload.dataOnly = false;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /proof boundary is invalid|hash verification failed/
);

console.log(
  `FLUID_HARNESS_FACTORY_RECOMMENDATION_VALIDATION_ARCHIVE_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true foreignRejected=true `
  + `doubleArchiveRejected=true archivedReportRejected=true staleRejected=true `
  + `mutableLedgerRejected=true tamperedRejected=true ledgerUnchanged=true `
  + `archived=${archived.archived} authoritySuppressed=${archived.authorityTransferred === false}`
);
