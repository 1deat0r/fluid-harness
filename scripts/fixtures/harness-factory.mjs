import { fileURLToPath } from 'node:url';

import { AgentArchitectureDiscoveryRunner } from '../../src/agent-architecture-discovery.mjs';
import { AgentArchitectureAdoptionAuthority } from '../../src/agent-architecture.mjs';
import { HarnessFactory } from '../../src/harness-factory.mjs';
import { AgentArchitectureProposalRunner } from '../../src/agent-architecture-proposal.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../../src/agent-search.mjs';
import { EvidenceLedger } from '../../src/evidence-ledger.mjs';
import { EvaluationBudget } from '../../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../../src/evidence.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../../src/process-boundary.mjs';
import { buildDistributionShiftFixture } from './distribution-shift.mjs';

export function buildHarnessFactoryFixture({
  prefix = 'harness-factory',
  includeResearch = true,
  proposalExportName = null,
  includeFailingPlanner = false,
  includePartialPlanner = false,
  adoptionAuthority = null
} = {}) {
  let researchContext = null;
  let researchLedger = null;
  if (includeResearch) {
    const { report: distributionShift } = buildDistributionShiftFixture({
      prefix: `${prefix}-research`
    });
    researchLedger = new EvidenceLedger();
    researchLedger.appendDistributionShift(distributionShift);
    const memory = memoryFromLedger({
      ledger: EvidenceLedger.fromSerialized(researchLedger.serialize()),
      idPrefix: `${prefix}-research`,
      maxEntries: 8
    });
    researchContext = buildStructuredMemoryContext({
      memory,
      query: {
        source: MEMORY_SOURCES.DISTRIBUTION_SHIFT,
        strategyKey: 'distribution-shift',
        keywords: ['distribution-shift', 'weakness-exposed']
      }
    });
  }

  const fixturePath = fileURLToPath(new URL('./process-boundary-candidate.mjs', import.meta.url));
  const plannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-registered-planner`,
    description: 'A deterministic process-isolated graph planner',
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphDirect',
        timeoutMs: 2000
      }),
      plannerId: `${prefix}-registered-planner-runtime`
    })
  });
  const failingPlannerCandidate = includeFailingPlanner
    ? new AgentPlannerCandidate({
      id: `${prefix}-failing-planner`,
      description: 'A deliberately incomplete process-isolated planner',
      plannerFactory: () => new ProcessBackedAgentPlanner({
        runner: new ProcessIsolatedRunner({
          modulePath: fixturePath,
          exportName: 'planMissingDescription',
          timeoutMs: 2000
        }),
        plannerId: `${prefix}-failing-planner-runtime`
      })
    })
    : null;
  const partialPlannerCandidate = includePartialPlanner
    ? new AgentPlannerCandidate({
      id: `${prefix}-partial-planner`,
      description: 'A process-isolated planner that handles only the first case',
      plannerFactory: () => new ProcessBackedAgentPlanner({
        runner: new ProcessIsolatedRunner({
          modulePath: fixturePath,
          exportName: 'planGraphFirstCase',
          timeoutMs: 2000
        }),
        plannerId: `${prefix}-partial-planner-runtime`
      })
    })
    : null;
  const proposalRunner = new AgentArchitectureProposalRunner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: proposalExportName
        ?? (includeResearch
          ? 'proposeArchitectureFromResearch'
          : 'proposeArchitectureDirect'),
      timeoutMs: 2000
    }),
    maxProposals: 2
  });
  const discoveryRunner = new AgentArchitectureDiscoveryRunner({
    proposalRunner,
    adoptionAuthority: adoptionAuthority ?? new AgentArchitectureAdoptionAuthority()
  });
  const ledger = new EvidenceLedger();
  const factory = new HarnessFactory({
    factoryId: `${prefix}-factory`,
    discoveryRunner,
    ledger
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
      && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
      && report.cycles[0].action.result?.path?.join('>') === 'A>B'
  });
  const secondEvaluationCase = new AgentPlannerCase({
    id: `${prefix}-second-case`,
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: `${prefix}-second-task`,
      description: 'Find a graph path'
    },
    task: {
      id: `${prefix}-second-task`,
      description: 'Find a graph path'
    },
    adversarial: false,
    expected: (report) => report?.completed === true
      && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
      && report.cycles[0].action.result?.path?.join('>') === 'A>B'
  });
  const holdoutCase = new AgentPlannerCase({
    id: `${prefix}-holdout-case`,
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: `${prefix}-holdout-task`,
      description: 'Find a graph path'
    },
    task: {
      id: `${prefix}-holdout-task`,
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (report) => report?.completed === true
      && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
      && report.cycles[0].action.result?.path?.join('>') === 'A>B'
  });
  const budgets = {
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };

  return {
    factory,
    ledger,
    researchLedger,
    researchContext,
    plannerCandidate,
    plannerCandidates: failingPlannerCandidate === null
      ? [plannerCandidate]
      : [failingPlannerCandidate, plannerCandidate],
    failingPlannerCandidate,
    partialPlannerCandidate,
    proposalRunner,
    discoveryRunner,
    evaluationCase,
    secondEvaluationCase,
    holdoutCase,
    evaluationCases: [evaluationCase, secondEvaluationCase],
    budgets
  };
}
