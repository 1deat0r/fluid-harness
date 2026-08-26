import { fileURLToPath } from 'node:url';

import { AgentArchitectureDiscoveryRunner } from '../../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../../src/agent-architecture-proposal.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../../src/agent-search.mjs';
import { EvaluationBudget } from '../../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./process-boundary-candidate.mjs', import.meta.url));

export function buildArchitectureDiscoveryReport({
  expected = (report) => report?.completed === true,
  caseId = 'architecture-discovery-ledger-case',
  plannerId = 'architecture-discovery-ledger-planner',
  goal = 'archive a bounded architecture discovery'
} = {}) {
  const plannerCandidate = new AgentPlannerCandidate({
    id: plannerId,
    description: 'A deterministic process-isolated graph planner',
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphDirect',
        timeoutMs: 2000
      }),
      plannerId: `${plannerId}-runtime`
    })
  });
  const discoveryRunner = new AgentArchitectureDiscoveryRunner({
    proposalRunner: new AgentArchitectureProposalRunner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'proposeArchitectureMany',
        timeoutMs: 2000
      }),
      maxProposals: 3
    })
  });
  const evaluationCase = new AgentPlannerCase({
    id: caseId,
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: `${caseId}-task`,
      description: 'Find a graph path'
    },
    task: {
      id: `${caseId}-task`,
      description: 'Find a graph path'
    },
    adversarial: true,
    expected
  });
  const budget = new EvaluationBudget({ maxCases: 1 });
  return discoveryRunner.discover({
    goal,
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    productionBudget: budget,
    researchBudget: budget,
    skepticBudget: budget
  });
}
