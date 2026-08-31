import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryReport,
  MAX_HARNESS_FACTORY_SELF_DESIGN_RESEARCH_RESULTS
} from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import {
  buildHarnessFactorySelfDesignFixture
} from './fixtures/harness-factory-self-design.mjs';

const fixture = buildHarnessFactorySelfDesignFixture({
  prefix: 'harness-factory-self-design'
});
const { factory, ledger, plannerCandidate, researchArchive, selfDesignOptions } = fixture;
const report = factory.selfDesignAndManufacture(selfDesignOptions());
assert.equal(isTrustedHarnessFactoryReport(report), true);
assert.equal(MAX_HARNESS_FACTORY_SELF_DESIGN_RESEARCH_RESULTS, 16);
assert.equal(report.status, 'ADOPTED');
assert.equal(report.researchContext.resultCount, 1);
assert.equal(report.researchContext.historicalOnly, true);
assert.equal(report.researchContext.dataOnly, true);
assert.equal(report.researchContext.authorityTransferred, false);
assert.equal(report.researchContext.sourceCounts[MEMORY_SOURCES.DISTRIBUTION_SHIFT], 1);
assert.deepEqual(report.researchContext.provenance, [{
  hash: researchArchive.hash,
  kind: researchArchive.kind,
  sequence: researchArchive.sequence
}]);
const discovery = ledger.restoreArchitectureDiscoveries()[0];
assert.equal(discovery.proposals.length, 1);
assert.equal(discovery.proposals[0].plannerCandidateId, plannerCandidate.id);
assert.equal(discovery.proposals[0].policy.maxEpisodes, 3);
assert.equal(
  discovery.proposals[0].components.decision,
  'harden-against-observed-weakness'
);
assert.equal(discovery.proposals[0].components.plannerSelection, 1);
assert.equal(discovery.proposals[0].components.evidenceResultCount, 1);
assert.equal(discovery.proposals[0].components.evidenceSourceCount, 1);
assert.equal(report.deployed, false);
assert.equal(report.authorityTransferred, false);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_SELF_DESIGN_OK `
  + `research=${report.researchContext.resultCount} source=${MEMORY_SOURCES.DISTRIBUTION_SHIFT} `
  + `selectedPlanner=${discovery.proposals[0].plannerCandidateId} nonDefault=true `
  + `policyEpisodes=${discovery.proposals[0].policy.maxEpisodes} `
  + `decision=${discovery.proposals[0].components.decision} `
  + `adopted=${report.status} deployed=${report.deployed} verify=${ledger.verify()}`
);
