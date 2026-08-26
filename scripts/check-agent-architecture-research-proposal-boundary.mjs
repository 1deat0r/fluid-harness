import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { memoryFromLedger, MEMORY_SOURCES } from '../src/memory.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { buildDistributionShiftFixture } from './fixtures/distribution-shift.mjs';

const { report } = buildDistributionShiftFixture({
  prefix: 'architecture-research-proposal-boundary'
});
const ledger = new EvidenceLedger();
ledger.appendDistributionShift(report);
const memory = memoryFromLedger({
  ledger,
  idPrefix: 'architecture-research-proposal-boundary',
  maxEntries: 8
});
const retrieval = memory.query({
  source: MEMORY_SOURCES.DISTRIBUTION_SHIFT,
  strategyKey: 'distribution-shift',
  keywords: ['distribution-shift', 'weakness-exposed']
});
const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
function proposer(exportName = 'proposeArchitectureFromResearch') {
  return new AgentArchitectureProposalRunner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName,
      timeoutMs: 2000
    }),
    maxProposals: 2
  });
}

const forgedContext = Object.freeze({
  retrieval: Object.freeze({
    query: retrieval.query,
    results: retrieval.results,
    returnedCount: retrieval.returnedCount,
    dataOnly: true,
    historicalOnly: true
  })
});
assert.throws(
  () => proposer().propose({
    goal: 'forged context',
    plannerCandidateIds: ['registered'],
    researchContext: forgedContext
  }),
  /trusted structured memory context/
);
assert.throws(
  () => proposer().propose({
    goal: 'raw retrieval context',
    plannerCandidateIds: ['registered'],
    researchContext: retrieval
  }),
  /trusted structured memory context/
);
const artifactContext = Object.freeze({
  ...retrieval,
  actionReport: {}
});
assert.throws(
  () => proposer().propose({
    goal: 'artifact context',
    plannerCandidateIds: ['registered'],
    researchContext: artifactContext
  }),
  /trusted structured memory context/
);
const accessorOptions = {};
Object.defineProperty(accessorOptions, 'goal', {
  enumerable: true,
  get() {
    return 'accessor goal';
  }
});
Object.defineProperty(accessorOptions, 'plannerCandidateIds', {
  enumerable: true,
  value: ['registered']
});
assert.throws(
  () => proposer().propose(accessorOptions),
  /only enumerable data properties/
);
assert.throws(
  () => proposer().propose({
    goal: 'extra key',
    plannerCandidateIds: ['registered'],
    extra: true
  }),
  /only enumerable data properties|unsupported property/
);

const noContextReport = proposer().propose({
  goal: 'no research context',
  plannerCandidateIds: ['registered']
});
assert.equal(noContextReport.researchContext, null);
assert.equal(noContextReport.proposals[0].components.researchSignal, 'none');
assert.equal(noContextReport.proposals[0].components.researchSource, 'NONE');
assert.equal(noContextReport.proposals[0].dataOnly, true);
assert.equal(Object.hasOwn(noContextReport.proposals[0], 'runner'), false);
assert.equal(Object.hasOwn(noContextReport.proposals[0], 'actionReport'), false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_RESEARCH_PROPOSAL_BOUNDARY_OK `
  + `forgedContextRejected=true rawRetrievalRejected=true artifactRejected=true `
  + `accessorRejected=true extraKeyRejected=true noContext=true `
  + `authoritySuppressed=true`
);
