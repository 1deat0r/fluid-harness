import { BoundedAgentRunner } from '../../src/agent.mjs';
import {
  ConstitutionalCore,
  Constitution
} from '../../src/constitution.mjs';
import { questionFor } from '../../src/curiosity.mjs';
import { EvidenceLedger } from '../../src/evidence-ledger.mjs';
import { EvaluationBudget, EvaluationCase } from '../../src/evaluation.mjs';
import { HeuristicRepresentationSelector } from '../../src/representation.mjs';
import { RepresentationCandidate } from '../../src/search.mjs';

export function buildResearchMemoryLedger({
  prefix = 'research-memory-ledger',
  count = 1
} = {}) {
  const core = new ConstitutionalCore({
    constitution: new Constitution({
      maxActions: count + 1,
      maxAuditEntries: count * 4 + 4
    })
  });
  const reports = [];
  for (let index = 1; index <= count; index += 1) {
    const plan = core.plan({
      id: `${prefix}-action-${index}`,
      description: 'Find a graph path'
    });
    const report = core.execute({
      plan,
      input: {
        nodes: ['A', 'B'],
        edges: [],
        start: 'A',
        goal: 'B'
      }
    });
    const question = questionFor({ actionReport: report });
    core.recordQuestion({
      taskId: plan.task.id,
      question,
      actionReport: report
    });
    reports.push(report);
  }
  const ledger = new EvidenceLedger();
  ledger.appendCore(core);
  return {
    core,
    ledger,
    reports,
    verifiedLedger: EvidenceLedger.fromSerialized(ledger.serialize())
  };
}

export function buildCompletedResearchMemoryLedger({
  prefix = 'completed-research-memory-ledger'
} = {}) {
  const run = new BoundedAgentRunner().run({
    episodes: [{
      task: { id: `${prefix}-action`, description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [],
        start: 'A',
        goal: 'B'
      },
      research: {
        candidates: [new RepresentationCandidate({
          id: `${prefix}-candidate`,
          selectorFactory: () => new HeuristicRepresentationSelector()
        })],
        cases: [new EvaluationCase({
          id: `${prefix}-case`,
          domain: 'graph',
          adversarial: true,
          task: { id: `${prefix}-case-task`, description: 'Find a graph path' },
          input: {
            nodes: ['A', 'B'],
            edges: [['A', 'B']],
            start: 'A',
            goal: 'B'
          },
          expected: (report) => report.result.path.join('>') === 'A>B'
        })],
        productionBudget: new EvaluationBudget({ maxCases: 1 }),
        researchBudget: new EvaluationBudget({ maxCases: 1 }),
        skepticBudget: new EvaluationBudget({ maxCases: 1 })
      }
    }]
  });
  const ledger = new EvidenceLedger();
  ledger.appendAgentRun(run);
  return {
    ledger,
    run,
    verifiedLedger: EvidenceLedger.fromSerialized(ledger.serialize())
  };
}
