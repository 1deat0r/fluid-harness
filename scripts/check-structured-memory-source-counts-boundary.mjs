import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import {
  AgentArchitectureProposalReport,
  AgentArchitectureProposalRunner
} from '../src/agent-architecture-proposal.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromAgentRun,
  MEMORY_SOURCES
} from '../src/memory.mjs';

const runReport = new BoundedAgentRunner().run({
  episodes: [{
    task: {
      id: 'source-counts-boundary-agent-run',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }]
});
const memory = memoryFromAgentRun({
  runReport,
  idPrefix: 'source-counts-boundary'
});
const initialSize = memory.size;
const initialIds = memory.entries.map(({ id }) => id);
const retrieval = memory.query({
  sources: [MEMORY_SOURCES.RESEARCH, MEMORY_SOURCES.ARCHITECTURE_DISCOVERY]
});
assert.deepEqual(retrieval.sourceCounts, {
  ARCHITECTURE_DISCOVERY: 0,
  RESEARCH: 0
});
assert.equal(Object.isFrozen(retrieval.sourceCounts), true);
assert.throws(
  () => {
    retrieval.sourceCounts.RESEARCH = 1;
  },
  TypeError
);

const context = buildStructuredMemoryContext({
  memory,
  query: {
    sources: [MEMORY_SOURCES.RESEARCH, MEMORY_SOURCES.ARCHITECTURE_DISCOVERY]
  }
});
const plannerData = context.toPlannerData();
assert.deepEqual(plannerData.sourceCounts, retrieval.sourceCounts);
assert.equal(Object.isFrozen(plannerData.sourceCounts), true);
assert.equal(plannerData.dataOnly, true);
assert.equal(plannerData.historicalOnly, true);
assert.equal(plannerData.authorityTransferred, false);
assert.equal(Object.hasOwn(plannerData, 'runner'), false);
assert.equal(Object.hasOwn(plannerData, 'actionReport'), false);

assert.throws(
  () => memory.query({ sources: [] }),
  /must contain at least one source/
);
const accessorSources = [];
Object.defineProperty(accessorSources, '0', {
  enumerable: true,
  configurable: true,
  get() {
    throw new Error('source accessor should not be read');
  }
});
assert.throws(
  () => memory.query({ sources: accessorSources }),
  /only enumerable data entries/
);

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'source-counts-boundary-planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'source-counts-boundary-planner-runtime'
  })
});
const proposalRunner = new AgentArchitectureProposalRunner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'proposeArchitectureDirect',
    timeoutMs: 2000
  }),
  maxProposals: 2
});
const validReport = proposalRunner.propose({
  goal: 'source-counts boundary proposal',
  plannerCandidateIds: [plannerCandidate.id],
  researchContext: context
});
const accessorSummary = { ...validReport.researchContext };
Object.defineProperty(accessorSummary, 'sourceCounts', {
  enumerable: true,
  configurable: true,
  get() {
    throw new Error('source-counts accessor should not be read');
  }
});
assert.throws(
  () => new AgentArchitectureProposalReport({
    goal: validReport.goal,
    proposals: validReport.proposals,
    source: validReport.source,
    researchContext: accessorSummary
  }),
  /enumerable data properties only/
);
assert.throws(
  () => new AgentArchitectureProposalReport({
    goal: validReport.goal,
    proposals: validReport.proposals,
    source: validReport.source,
    researchContext: {
      ...validReport.researchContext,
      sourceCounts: { RESEARCH: -1 }
    }
  }),
  /source counts are invalid/
);
assert.throws(
  () => new AgentArchitectureProposalReport({
    goal: validReport.goal,
    proposals: validReport.proposals,
    source: validReport.source,
    researchContext: {
      ...validReport.researchContext,
      resultCount: validReport.researchContext.resultCount + 1
    }
  }),
  /source counts are invalid/
);

assert.equal(memory.size, initialSize);
assert.deepEqual(memory.entries.map(({ id }) => id), initialIds);

console.log(
  `FLUID_STRUCTURED_MEMORY_SOURCE_COUNTS_BOUNDARY_OK `
  + `frozen=true zeroCounts=true invalidQueryRejected=true accessorRejected=true `
  + `summaryAccessorRejected=true negativeCountRejected=true unchanged=true `
  + 'authorityTransferred=false'
);
