import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  isTrustedMemoryAwareAgentRunReport,
  memoryAwareAgentFromLedger
} from '../src/memory-agent.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { buildArchitectureDiscoveryReport } from './fixtures/architecture-discovery-ledger.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const discovery = buildArchitectureDiscoveryReport({
  caseId: 'memory-ledger-architecture-discovery-boundary-case',
  plannerId: 'memory-ledger-architecture-discovery-boundary-planner',
  goal: 'test discovery memory source boundaries'
});
const ledger = new EvidenceLedger();
ledger.appendArchitectureDiscovery(discovery);
const verifiedLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraphFromMemory',
    timeoutMs: 2000
  }),
  plannerId: 'memory-ledger-architecture-discovery-boundary-runtime'
});

assert.throws(
  () => memoryAwareAgentFromLedger({ ledger: {}, planner }),
  /trusted evidence ledger/
);
const agent = memoryAwareAgentFromLedger({
  ledger: verifiedLedger,
  planner
});
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: { source: 'FORGED' },
    context: { taskId: 'memory-ledger-architecture-discovery-invalid-source' }
  }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.ARCHITECTURE_DISCOVERY;
  }
});
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: accessorQuery,
    context: { taskId: 'memory-ledger-architecture-discovery-accessor' }
  }),
  /only enumerable data properties/
);
const noDiscovery = agent.run({
  goal: 'graph',
  query: { source: MEMORY_SOURCES.AGENT_RUN },
  context: {
    taskId: 'memory-ledger-architecture-discovery-no-match',
    description: 'Find a graph path'
  },
  reproduction: 'memory-ledger-architecture-discovery-no-match'
});

assert.equal(isTrustedMemoryAwareAgentRunReport(noDiscovery), true);
assert.equal(noDiscovery.memoryContext.resultCount, 0);
assert.deepEqual(noDiscovery.run.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
assert.equal(noDiscovery.memoryContext.authorityTransferred, false);
assert.equal(Object.hasOwn(noDiscovery.memoryContext, 'results'), false);
assert.equal(Object.hasOwn(noDiscovery, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_LEDGER_ARCHITECTURE_DISCOVERY_PLANNER_BOUNDARY_OK forgedLedgerRejected=true `
  + `invalidSourceRejected=true accessorRejected=true noMatch=${noDiscovery.memoryContext.resultCount} `
  + `freshProof=${noDiscovery.run.actionEvidence[0]} authoritySuppressed=`
  + `${noDiscovery.memoryContext.authorityTransferred === false}`
);
