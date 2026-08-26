import { BoundedAgentRunner } from '../../src/agent.mjs';
import { MemoryAwareAgentCoordinationRunner } from '../../src/memory-agent-coordination.mjs';
import { EvidenceLedger } from '../../src/evidence-ledger.mjs';
import { buildArchitectureDiscoveryReport } from './architecture-discovery-ledger.mjs';

export function buildMemoryAwareCoordinationLedger({ prefix = 'memory-aware-coordination-ledger' } = {}) {
  const discovery = buildArchitectureDiscoveryReport({
    caseId: `${prefix}-discovery-case`,
    plannerId: `${prefix}-discovery-planner`,
    goal: `${prefix} architecture`
  });
  const ledger = new EvidenceLedger();
  ledger.appendAgentRun(new BoundedAgentRunner().run({
    episodes: [{
      task: {
        id: `${prefix}-history`,
        description: 'Find a graph path'
      },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      }
    }]
  }));
  const coordination = new MemoryAwareAgentCoordinationRunner({
    agentCount: 2,
    maxRounds: 2,
    minimumProvenAgents: 2
  }).run({
    adoption: discovery.adoption.adoption,
    ledger,
    agentGoal: 'graph',
    query: { keywords: ['graph-algorithms'], limit: 3 },
    context: {
      taskId: `${prefix}-task`,
      description: 'Find a graph path'
    },
    reproduction: `${prefix}-proof`
  });
  ledger.appendMemoryAwareCoordination(coordination);
  const verifiedLedger = EvidenceLedger.fromSerialized(ledger.serialize());
  return { ledger, coordination, verifiedLedger };
}
