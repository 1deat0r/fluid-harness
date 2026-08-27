import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

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
    description: 'candidate for research-plan provenance boundary checks',
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: recommendation.baseline.architecture.components
  });
}

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerialize(value[key])}`
  )).join(',')}}`;
}

function resealReceipt(serialized, resultArchiveSequences) {
  const parsed = JSON.parse(serialized);
  const receipt = parsed.records[parsed.records.length - 1];
  receipt.payload.resultArchiveSequences = resultArchiveSequences;
  const material = {
    schemaVersion: receipt.schemaVersion,
    sequence: receipt.sequence,
    kind: receipt.kind,
    payload: receipt.payload,
    previousHash: receipt.previousHash
  };
  receipt.hash = `sha256:${createHash('sha256')
    .update(stableSerialize(material))
    .digest('hex')}`;
  return JSON.stringify(parsed);
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-provenance-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
fixture.factory.manufacture({
  goal: 'create a receipt for provenance boundary checks',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const plan = fixture.factory.researchPlan().plans[0];
fixture.factory.executeResearchPlanReceipt(plan, {
  candidate: reconstructedCandidate(fixture, fixture.factory.recommend()),
  holdoutCases: [fixture.holdoutCase],
  ...holdoutBudgets()
});
const before = fixture.ledger.serialize();

const missingArchive = resealReceipt(before, [999999]);
assert.throws(
  () => EvidenceLedger.fromSerialized(missingArchive),
  /archive is not in the current chain/
);

const wrongKindArchive = resealReceipt(before, [1]);
assert.throws(
  () => EvidenceLedger.fromSerialized(wrongKindArchive),
  /archive kind does not match the result/
);

const emptyArchives = resealReceipt(before, []);
assert.throws(
  () => EvidenceLedger.fromSerialized(emptyArchives),
  /must reference an archive/
);

assert.equal(fixture.ledger.serialize(), before);
assert.equal(fixture.ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_RESEARCH_PLAN_PROVENANCE_BOUNDARY_OK `
  + `missingRejected=true wrongKindRejected=true emptyRejected=true `
  + `ledgerUnchanged=true verified=${fixture.ledger.verify()}`
);
