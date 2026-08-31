import assert from 'node:assert/strict';

import {
  buildHarnessFactorySelfDesignFixture
} from './fixtures/harness-factory-self-design.mjs';

const empty = buildHarnessFactorySelfDesignFixture({
  prefix: 'harness-factory-self-design-no-evidence',
  includeResearchEvidence: false
});
const beforeEmpty = empty.ledger.serialize();
assert.throws(
  () => empty.factory.selfDesignAndManufacture(empty.selfDesignOptions()),
  /requires verified ledger research/
);
assert.equal(empty.ledger.serialize(), beforeEmpty);

const rejected = buildHarnessFactorySelfDesignFixture({
  prefix: 'harness-factory-self-design-evidence-rejected'
});
const report = rejected.factory.selfDesignAndManufacture(rejected.selfDesignOptions({
  plannerCandidates: [rejected.failingPlannerCandidate]
}));
assert.equal(report.researchContext.resultCount, 1);
assert.equal(report.status, 'REJECTED');
assert.equal(report.freshAdoption, false);
assert.equal(report.proofStatus, 'NONE');
assert.equal(report.agentRunRequested, true);
assert.equal(report.agentBuilt, false);
assert.equal(report.agentRun, null);
assert.equal(report.agentArchive, null);
assert.equal(report.deployed, false);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(rejected.ledger.restoreAgentRuns().length, 0);
assert.equal(rejected.ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_SELF_DESIGN_EVIDENCE_BOUNDARY_OK `
  + `noEvidenceRejected=true ledgerAtomic=true research=${report.researchContext.resultCount} `
  + `status=${report.status} adopted=${report.freshAdoption} proof=${report.proofStatus} `
  + `agentBuilt=${report.agentBuilt} deployed=${report.deployed} `
  + `authorityTransferred=${report.authorityTransferred} verify=${rejected.ledger.verify()}`
);
