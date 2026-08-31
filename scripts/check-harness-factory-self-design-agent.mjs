import assert from 'node:assert/strict';

import {
  buildHarnessFactorySelfDesignFixture
} from './fixtures/harness-factory-self-design.mjs';

const fixture = buildHarnessFactorySelfDesignFixture({
  prefix: 'harness-factory-self-design-agent'
});
const { factory, ledger, plannerCandidate, selfDesignOptions } = fixture;
const report = factory.selfDesignAndManufacture(selfDesignOptions());
assert.equal(report.status, 'ADOPTED');
assert.equal(report.complete, true);
assert.equal(report.primaryComplete, true);
assert.equal(report.reproductionComplete, true);
assert.equal(report.reproducible, true);
assert.equal(report.freshAdoption, true);
assert.equal(report.proofStatus, 'PROVEN');
assert.equal(report.holdoutRequested, true);
assert.equal(report.holdoutStatus, 'PASSED');
assert.equal(report.holdout.complete, true);
assert.equal(report.holdout.proven, 1);
assert.equal(report.holdout.independent, true);
assert.equal(report.agentRunRequested, true);
assert.equal(report.agentBuilt, true);
assert.equal(report.agentRun.completed, true);
assert.equal(report.agentRun.provenActions, 1);
assert.equal(report.agentRun.auditValid, true);
assert.equal(report.agentRun.plannerId, `${plannerCandidate.id}-runtime`);
assert.equal(report.agentProofStatus, 'PROVEN');
assert.equal(report.archive.kind, 'architecture-discovery');
assert.equal(report.agentArchive.kind, 'agent-run');
assert.equal(report.archive.sequence < report.agentArchive.sequence, true);
assert.deepEqual(
  ledger.records.map(({ kind }) => kind),
  ['distribution-shift', 'architecture-discovery', 'agent-run']
);
assert.equal(Object.hasOwn(report, 'agent'), false);
assert.equal(Object.hasOwn(report, 'planner'), false);
assert.equal(Object.hasOwn(report, 'runner'), false);
assert.equal(report.deployed, false);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_SELF_DESIGN_AGENT_OK `
  + `primary=${report.primaryComplete} replay=${report.reproducible} `
  + `adopted=${report.status} holdout=${report.holdoutStatus} `
  + `agentBuilt=${report.agentBuilt} completed=${report.agentRun.completed} `
  + `proof=${report.agentProofStatus} archives=${report.archive.sequence}>${report.agentArchive.sequence} `
  + `deployed=${report.deployed} verify=${ledger.verify()}`
);
