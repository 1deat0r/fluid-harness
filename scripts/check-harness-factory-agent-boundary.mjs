import assert from 'node:assert/strict';

import { AgentArchitectureDiscoveryRunner } from '../src/agent-architecture-discovery.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-agent-boundary',
  includeResearch: true
});
const {
  factory,
  ledger,
  researchContext,
  plannerCandidate,
  proposalRunner,
  evaluationCase,
  budgets
} = fixture;

function validOptions(overrides = {}) {
  return {
    goal: 'boundary runtime manufacture',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    researchContext: null,
    agentGoal: 'graph',
    agentContext: {
      taskId: 'harness-factory-agent-boundary-task',
      description: 'Find a graph path'
    },
    agentReproduction: 'harness-factory-agent-boundary-proof',
    ...overrides
  };
}

const accessorContext = {};
Object.defineProperty(accessorContext, 'taskId', {
  enumerable: true,
  get() {
    return 'accessor-task';
  }
});
assert.throws(
  () => factory.manufacture(validOptions({ agentContext: accessorContext })),
  /enumerable data properties only/
);
assert.throws(
  () => factory.manufacture(validOptions({ toolRegistry: {} })),
  /trusted ToolRegistry/
);
assert.throws(
  () => factory.manufacture(validOptions({ toolRegistry: new Proxy({}, {}) })),
  /trusted ToolRegistry/
);
assert.throws(
  () => factory.manufacture(validOptions({ agentReproduction: '' })),
  /agentReproduction must be a non-empty string/
);
assert.throws(
  () => factory.manufacture(validOptions({ agentGoal: '' })),
  /agentGoal must be a non-empty string/
);
const cyclicContext = {};
cyclicContext.self = cyclicContext;
assert.throws(
  () => factory.manufacture(validOptions({ agentContext: cyclicContext })),
  /must not contain cycles/
);
assert.equal(ledger.length, 0);

const noArchive = factory.manufacture(validOptions({
  researchContext,
  archive: false
}));
assert.equal(isTrustedHarnessFactoryReport(noArchive), true);
assert.equal(noArchive.agentRunRequested, true);
assert.equal(noArchive.agentBuilt, true);
assert.equal(noArchive.agentRun.completed, true);
assert.equal(noArchive.agentProofStatus, 'PROVEN');
assert.equal(noArchive.archive, null);
assert.equal(noArchive.agentArchive, null);
assert.equal(ledger.length, 0);
assert.equal(noArchive.deployed, false);
assert.equal(noArchive.dataOnly, true);
assert.equal(noArchive.authorityTransferred, false);
assert.equal(Object.hasOwn(noArchive, 'agent'), false);
assert.equal(Object.hasOwn(noArchive, 'runReport'), false);
assert.equal(Object.hasOwn(noArchive, 'actionReport'), false);

const failedCase = new AgentPlannerCase({
  id: 'harness-factory-agent-boundary-failed-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-agent-boundary-failed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-agent-boundary-failed-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: () => false
});
const failedLedger = new EvidenceLedger();
const failedFactory = new HarnessFactory({
  factoryId: 'harness-factory-agent-boundary-failed-factory',
  discoveryRunner: new AgentArchitectureDiscoveryRunner({ proposalRunner }),
  ledger: failedLedger
});
const rejected = failedFactory.manufacture({
  goal: 'do not build without adoption',
  plannerCandidates: [plannerCandidate],
  cases: [failedCase],
  ...budgets,
  researchContext: null,
  agentGoal: 'graph',
  agentContext: {
    taskId: 'harness-factory-agent-boundary-no-adoption-task',
    description: 'Find a graph path'
  }
});
assert.equal(isTrustedHarnessFactoryReport(rejected), true);
assert.equal(rejected.status, 'REJECTED');
assert.equal(rejected.agentRunRequested, true);
assert.equal(rejected.agentBuilt, false);
assert.equal(rejected.agentRun, null);
assert.equal(rejected.agentArchive, null);
assert.equal(rejected.deployed, false);
assert.equal(failedLedger.length, 1);
assert.equal(failedLedger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_AGENT_BOUNDARY_OK `
  + `accessorContextRejected=true toolRegistryRejected=true proxyRegistryRejected=true `
  + `reproductionRejected=true goalRejected=true cyclicContextRejected=true `
  + `noArchiveRuntime=true authoritySuppressed=true missingAdoption=${rejected.status} `
  + `agentBuiltWithoutAdoption=${rejected.agentBuilt}`
);
