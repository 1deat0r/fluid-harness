import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentPolicy,
  EvolutionAuthority,
  MUTATION_LEVELS
} from '../src/evolution.mjs';
import {
  CognitiveCycleRunner
} from '../src/cycle.mjs';
import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import {
  BoundedAgentRunner
} from '../src/agent.mjs';
import { HeuristicRepresentationSelector, REPRESENTATIONS } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { ToolDefinition, ToolRegistry } from '../src/tool.mjs';

const cases = [
  new EvaluationCase({
    id: 'policy-application-graph',
    domain: 'graph',
    task: { id: 'policy-application-graph-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report.result.path.join('>') === 'A>B'
  }),
  new EvaluationCase({
    id: 'policy-application-ambiguous',
    domain: 'robustness',
    productionEligible: false,
    adversarial: true,
    requiresProof: false,
    task: { id: 'policy-application-ambiguous-task', description: 'Graph database' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (_report, error) => error?.message.includes('No executor')
  })
];
const candidates = [
  new RepresentationCandidate({
    id: 'policy-application-baseline',
    selectorFactory: () => ({ select: () => REPRESENTATIONS.GRAPH })
  }),
  new RepresentationCandidate({
    id: 'policy-application-candidate',
    selectorFactory: () => new HeuristicRepresentationSelector()
  })
];
const evaluateSearch = () => new RepresentationSearchRunner().evaluate({
  candidates,
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 2 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
const searchReport = evaluateSearch();
const reproductionReport = evaluateSearch();
const previousPolicy = new AgentPolicy({ maxEpisodes: 4, maxToolCallsPerEpisode: 2 });
const currentPolicy = new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 1 });
const authority = new EvolutionAuthority({ unlockedThrough: MUTATION_LEVELS.PROMPTS });
const proposal = authority.propose({
  id: 'policy-application-proposal',
  level: MUTATION_LEVELS.POLICIES,
  searchReport,
  reproductionReport,
  baselineCandidateId: 'policy-application-baseline',
  candidateCandidateId: 'policy-application-candidate',
  baselinePolicy: previousPolicy,
  candidatePolicy: currentPolicy
});
const decision = authority.approve(proposal);
assert.equal(decision.approved, true);
const application = authority.applyAgentPolicy({
  permit: decision.permit,
  currentPolicy: previousPolicy,
  nextPolicy: currentPolicy
});

const cycleRunner = new CognitiveCycleRunner();
const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const toolRegistry = new ToolRegistry({
  tools: [new ToolDefinition({
    id: 'policy-application-tool',
    description: 'Builds graph input for policy application checks',
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'toolGraphInput',
      timeoutMs: 2000
    })
  })]
});
const constrainedRunner = new BoundedAgentRunner({
  cycleRunner,
  toolRegistry,
  policy: application.currentPolicy
});
assert.equal(constrainedRunner.cycleRunner, cycleRunner);
assert.equal(constrainedRunner.toolRegistry, toolRegistry);
assert.equal(constrainedRunner.policy, application.currentPolicy);
assert.deepEqual(
  Object.keys(application.currentPolicy).sort(),
  ['dataOnly', 'maxEpisodes', 'maxToolCallsPerEpisode']
);
assert.equal(Object.hasOwn(application.currentPolicy, 'cycleRunner'), false);
assert.equal(Object.hasOwn(application.currentPolicy, 'planner'), false);
assert.equal(Object.hasOwn(application.currentPolicy, 'toolRegistry'), false);
assert.throws(
  () => constrainedRunner.run({
    episodes: [
      { task: { id: 'policy-cap-1', description: 'Find a graph path' }, input: {} },
      { task: { id: 'policy-cap-2', description: 'Find a graph path' }, input: {} },
      { task: { id: 'policy-cap-3', description: 'Find a graph path' }, input: {} }
    ]
  }),
  /maximum is 2/
);
assert.equal(cycleRunner.core.status.actionsUsed, 0);

const tooManyToolsRunner = new BoundedAgentRunner({
  toolRegistry,
  policy: application.currentPolicy
});
assert.throws(
  () => tooManyToolsRunner.run({
    episodes: [{
      task: { id: 'policy-tool-cap', description: 'Find a graph path' },
      toolCalls: [
        { toolId: 'policy-application-tool', callId: 'policy-tool-1', input: {} },
        { toolId: 'policy-application-tool', callId: 'policy-tool-2', input: {} }
      ],
      inputFromToolCall: 'policy-tool-1'
    }]
  }),
  /maximum is 1/
);
assert.equal(tooManyToolsRunner.cycleRunner.core.status.actionsUsed, 0);

const rollbackRunner = new BoundedAgentRunner({
  policy: application.previousPolicy
});
const rollbackReport = rollbackRunner.run({
  episodes: [
    {
      task: { id: 'rollback-1', description: 'Find a graph path' },
      input: { nodes: ['A', 'B'], edges: [['A', 'B']], start: 'A', goal: 'B' }
    },
    {
      task: { id: 'rollback-2', description: 'Find a graph path' },
      input: { nodes: ['A', 'B'], edges: [['A', 'B']], start: 'A', goal: 'B' }
    },
    {
      task: { id: 'rollback-3', description: 'Find a graph path' },
      input: { nodes: ['A', 'B'], edges: [['A', 'B']], start: 'A', goal: 'B' }
    }
  ]
});
assert.equal(rollbackReport.completed, true);
assert.equal(rollbackReport.policy, application.previousPolicy);
assert.equal(rollbackReport.cycles.length, 3);
assert.equal(application.previousPolicy.maxEpisodes, 4);
assert.equal(application.currentPolicy.maxEpisodes, 2);

console.log(
  `FLUID_AGENT_POLICY_APPLICATION_OK completed=${rollbackReport.completed} `
  + `currentMaxEpisodes=${application.currentPolicy.maxEpisodes} `
  + `rollbackMaxEpisodes=${application.previousPolicy.maxEpisodes} `
  + `actionCapRejected=${cycleRunner.core.status.actionsUsed === 0} `
  + `toolCapRejected=${tooManyToolsRunner.cycleRunner.core.status.actionsUsed === 0} `
  + 'codeMutation=false'
);
