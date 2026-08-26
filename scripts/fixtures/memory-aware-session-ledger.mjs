import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../../src/agent.mjs';
import { AgentArchitectureProposalRunner } from '../../src/agent-architecture-proposal.mjs';
import {
  MemoryAwareAgentSessionRunner
} from '../../src/memory-agent-session.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../../src/agent-search.mjs';
import { EvaluationBudget } from '../../src/evaluation.mjs';
import { EvidenceLedger } from '../../src/evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from '../../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../../src/process-boundary.mjs';

export function buildMemoryAwareSessionLedger({ prefix = 'memory-aware-session-ledger' } = {}) {
  const fixturePath = fileURLToPath(new URL('./process-boundary-candidate.mjs', import.meta.url));
  const plannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-planner-candidate`,
    description: 'A deterministic process-isolated graph planner',
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphCoordination',
        timeoutMs: 2000
      }),
      plannerId: `${prefix}-planner-runtime`
    })
  });
  const session = new MemoryAwareAgentSessionRunner({
    proposalRunner: new AgentArchitectureProposalRunner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'proposeArchitectureDirect',
        timeoutMs: 2000
      })
    }),
    agentCount: 2,
    maxRounds: 2,
    minimumProvenAgents: 2
  });
  const evaluationCase = new AgentPlannerCase({
    id: `${prefix}-case`,
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: `${prefix}-task`,
      description: 'Find a graph path'
    },
    task: {
      id: `${prefix}-task`,
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (report) => report?.completed === true
      && report.cycles.length === 1
      && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
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
  const report = session.run({
    architectureGoal: `${prefix} architecture`,
    agentGoal: 'graph',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 }),
    ledger,
    query: { keywords: ['graph-algorithms'], limit: 3 },
    context: {
      taskId: `${prefix}-run`,
      description: 'Find a graph path'
    },
    reproduction: `${prefix}-proof`
  });
  ledger.appendMemoryAwareSession(report);
  const verifiedLedger = EvidenceLedger.fromSerialized(ledger.serialize());
  return { ledger, report, verifiedLedger };
}
