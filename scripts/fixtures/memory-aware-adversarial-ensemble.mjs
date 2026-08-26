import { fileURLToPath } from 'node:url';

import { AdversarialLineageEnsembleRunner } from '../../src/adversarial-lineage-ensemble.mjs';
import { EvidenceLedger } from '../../src/evidence-ledger.mjs';
import { EvaluationCase } from '../../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../../src/evidence.mjs';
import { memoryAwareAgentFromLedger } from '../../src/memory-agent.mjs';
import { MemoryAwareAgentEnsembleRunner } from '../../src/memory-agent-ensemble.mjs';
import { MEMORY_SOURCES } from '../../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../../src/process-boundary.mjs';

export function buildMemoryAwareAdversarialEnsemble({
  prefix = 'memory-aware-adversarial-ensemble',
  failingMember = null
} = {}) {
  const cases = [
    new EvaluationCase({
      id: `${prefix}-success`,
      domain: 'graph',
      adversarial: true,
      task: {
        id: `${prefix}-success-task`,
        description: 'Find a graph path'
      },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
    }),
    new EvaluationCase({
      id: `${prefix}-weakness`,
      domain: 'graph',
      adversarial: true,
      task: {
        id: `${prefix}-weakness-task`,
        description: 'Find a graph path'
      },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: () => false
    })
  ];
  const skepticEnsemble = new AdversarialLineageEnsembleRunner({
    ensembleId: `${prefix}-skeptic-history`,
    maxLineages: 3
  }).run({
    candidateId: `${prefix}-skeptic-kernel`,
    cases,
    lineageCount: 3
  });
  const ledger = new EvidenceLedger();
  ledger.appendAdversarialLineageEnsemble(skepticEnsemble);
  const verifiedLedger = EvidenceLedger.fromSerialized(ledger.serialize());
  const fixturePath = fileURLToPath(new URL('./process-boundary-candidate.mjs', import.meta.url));
  const agents = [];
  for (let index = 0; index < 2; index += 1) {
    agents.push(memoryAwareAgentFromLedger({
      ledger: verifiedLedger,
      planner: new ProcessBackedAgentPlanner({
        runner: new ProcessIsolatedRunner({
          modulePath: fixturePath,
          exportName: index === failingMember
            ? 'planMissingDescription'
            : 'planGraphFromMemory',
          timeoutMs: 2000
        }),
        plannerId: `${prefix}-planner-${index + 1}`
      })
    }));
  }
  const report = new MemoryAwareAgentEnsembleRunner({
    maxAgents: 2,
    minimumProvenAgents: 2
  }).run({
    agents,
    goal: 'graph',
    query: {
      source: MEMORY_SOURCES.ADVERSARIAL_LINEAGE,
      strategyKey: 'adversarial-lineage-ensemble',
      keywords: ['independent', 'weakness-exposed'],
      limit: 1
    },
    context: {
      taskId: `${prefix}-next-task`,
      description: 'Find a graph path'
    },
    reproduction: `${prefix}-proof`
  });
  return {
    agents,
    ledger: verifiedLedger,
    report,
    skepticEnsemble
  };
}
