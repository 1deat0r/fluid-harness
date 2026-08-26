import { fileURLToPath } from 'node:url';

import { FluidHarness } from './harness.mjs';
import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES,
  PromotionAuthority
} from './evaluation.mjs';
import { ScalingLevel, ScalingRunner } from './scaling.mjs';
import {
  selectorFromPromotedSearch,
  RepresentationCandidate,
  RepresentationSearchRunner
} from './search.mjs';
import { HeuristicRepresentationSelector, REPRESENTATIONS } from './representation.mjs';
import {
  EvolutionAuthority,
  isTrustedMutationPermit,
  MUTATION_LEVELS
} from './evolution.mjs';
import { CognitiveCycleRunner } from './cycle.mjs';
import { BoundedAgentRunner } from './agent.mjs';
import { EvidenceLedger } from './evidence-ledger.mjs';
import { ConstitutionalCore } from './constitution.mjs';
import { questionFor } from './curiosity.mjs';
import { BoundedResearchScheduler } from './research-scheduler.mjs';
import { isInstanceOf } from './intrinsics.mjs';
import { ExecutorRegistry } from './executor.mjs';
import {
  ModelProviderExecutor,
  ProcessBackedModelProvider
} from './model-provider.mjs';
import { ProcessIsolatedRunner } from './process-boundary.mjs';

function runDemo() {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'demo-dependency-path',
    description: 'Find the shortest path through a dependency graph'
  });
  const report = harness.execute({
    plan,
    input: {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']],
      start: 'A',
      goal: 'D'
    },
    reproduction: 'node src/cli.mjs demo'
  });

  console.log(JSON.stringify({
    taskId: report.taskId,
    representation: report.strategy.representation,
    reasoningEngine: report.strategy.reasoningEngine,
    path: report.result.path,
    evidence: report.evidence,
    surpriseBand: report.surpriseBand,
    invariantsChecked: report.invariantsChecked.length,
    verifierId: report.verification?.verifierId,
    environmentHash: report.environmentHash
  }));
  console.log(`FLUID_DEMO_OK evidence=${report.evidence} path=${report.result.path.join('>')} verifier=${report.verification?.verifierId}`);
}

function runConstraintDemo() {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'demo-resource-schedule',
    description: 'Schedule jobs under resource constraints'
  });
  const report = harness.execute({
    plan,
    input: {
      resources: { cpu: 2 },
      jobs: [
        { id: 'build', duration: 2, demand: { cpu: 2 } },
        { id: 'lint', duration: 1, demand: { cpu: 1 } },
        { id: 'test', duration: 1, demand: { cpu: 2 }, prerequisites: ['build'] },
        { id: 'package', duration: 1, demand: { cpu: 1 }, prerequisites: ['lint', 'test'] }
      ]
    },
    reproduction: 'node src/cli.mjs constraint-demo'
  });

  console.log(JSON.stringify({
    taskId: report.taskId,
    representation: report.strategy.representation,
    reasoningEngine: report.strategy.reasoningEngine,
    schedule: report.result.schedule,
    makespan: report.result.makespan,
    evidence: report.evidence,
    surpriseBand: report.surpriseBand,
    invariantsChecked: report.invariantsChecked.length,
    verifierId: report.verification?.verifierId,
    environmentHash: report.environmentHash
  }));
  console.log(`FLUID_CONSTRAINT_DEMO_OK evidence=${report.evidence} makespan=${report.result.makespan} verifier=${report.verification?.verifierId}`);
}

function runArrayDemo() {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'demo-array-addition',
    description: 'Compute an elementwise array sum'
  });
  const report = harness.execute({
    plan,
    input: {
      left: [1, 2, 3],
      right: [4, 5, 6],
      operation: 'add'
    },
    reproduction: 'node src/cli.mjs array-demo'
  });

  console.log(JSON.stringify({
    taskId: report.taskId,
    representation: report.strategy.representation,
    reasoningEngine: report.strategy.reasoningEngine,
    values: report.result.values,
    evidence: report.evidence,
    invariantsChecked: report.invariantsChecked.length,
    verifierId: report.verification?.verifierId,
    environmentHash: report.environmentHash
  }));
  console.log(`FLUID_ARRAY_DEMO_OK evidence=${report.evidence} values=${report.result.values.join(',')} verifier=${report.verification?.verifierId}`);
}

function runDatabaseQueryDemo() {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'demo-database-query',
    description: 'Run a database query over customer records'
  });
  const report = harness.execute({
    plan,
    input: {
      rows: [
        { id: 'a', status: 'open', score: 3 },
        { id: 'b', status: 'closed', score: 9 },
        { id: 'c', status: 'open', score: 7 }
      ],
      filter: { field: 'status', equals: 'open' },
      select: ['id', 'score'],
      sort: { field: 'score', direction: 'desc' },
      limit: 2
    },
    reproduction: 'node src/cli.mjs database-demo'
  });

  console.log(JSON.stringify({
    taskId: report.taskId,
    representation: report.strategy.representation,
    reasoningEngine: report.strategy.reasoningEngine,
    rows: report.result.rows,
    matchedRows: report.result.matchedRows,
    evidence: report.evidence,
    verifierId: report.verification?.verifierId,
    environmentHash: report.environmentHash
  }));
  console.log(
    `FLUID_DATABASE_DEMO_OK evidence=${report.evidence} `
    + `rows=${report.result.returnedRows} verifier=${report.verification?.verifierId}`
  );
}

function runTheoremDemo() {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'demo-formal-theorem',
    description: 'Prove a formal theorem from assumptions'
  });
  const report = harness.execute({
    plan,
    input: {
      variables: ['p', 'q'],
      assumptions: [
        { op: 'implies', left: { op: 'var', name: 'p' }, right: { op: 'var', name: 'q' } },
        { op: 'var', name: 'p' }
      ],
      conclusion: { op: 'var', name: 'q' }
    },
    reproduction: 'node src/cli.mjs theorem-demo'
  });

  console.log(JSON.stringify({
    taskId: report.taskId,
    representation: report.strategy.representation,
    reasoningEngine: report.strategy.reasoningEngine,
    proved: report.result.proved,
    assignmentsChecked: report.result.assignmentsChecked,
    evidence: report.evidence,
    verifierId: report.verification?.verifierId,
    environmentHash: report.environmentHash
  }));
  console.log(
    `FLUID_THEOREM_DEMO_OK proved=${report.result.proved} `
    + `assignments=${report.result.assignmentsChecked} evidence=${report.evidence} `
    + `verifier=${report.verification?.verifierId}`
  );
}

function runBayesianDemo() {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'demo-bayesian-posterior',
    description: 'Calculate a Bayesian posterior probability'
  });
  const report = harness.execute({
    plan,
    input: {
      observation: 'wet',
      hypotheses: [
        { id: 'rain', prior: 0.2, likelihoods: { wet: 0.9, dry: 0.1 } },
        { id: 'clear', prior: 0.8, likelihoods: { wet: 0.2, dry: 0.8 } }
      ]
    },
    reproduction: 'node src/cli.mjs bayesian-demo'
  });

  console.log(JSON.stringify({
    taskId: report.taskId,
    representation: report.strategy.representation,
    reasoningEngine: report.strategy.reasoningEngine,
    observation: report.result.observation,
    observationProbability: report.result.observationProbability,
    posterior: report.result.posterior,
    mostLikely: report.result.mostLikely,
    evidence: report.evidence,
    verifierId: report.verification?.verifierId,
    environmentHash: report.environmentHash
  }));
  console.log(
    `FLUID_BAYESIAN_DEMO_OK observation=${report.result.observation} `
    + `mostLikely=${report.result.mostLikely} evidence=${report.evidence} `
    + `verifier=${report.verification?.verifierId}`
  );
}

function runSimulationDemo() {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'demo-finite-state-simulation',
    description: 'Simulate a finite state-machine scenario'
  });
  const report = harness.execute({
    plan,
    input: {
      states: ['idle', 'running', 'done'],
      initialState: 'idle',
      transitions: [
        { from: 'idle', event: 'start', to: 'running' },
        { from: 'running', event: 'finish', to: 'done' }
      ],
      events: ['start', 'finish']
    },
    reproduction: 'node src/cli.mjs simulation-demo'
  });

  console.log(JSON.stringify({
    taskId: report.taskId,
    representation: report.strategy.representation,
    reasoningEngine: report.strategy.reasoningEngine,
    trace: report.result.trace,
    finalState: report.result.finalState,
    completed: report.result.completed,
    evidence: report.evidence,
    verifierId: report.verification?.verifierId,
    environmentHash: report.environmentHash
  }));
  console.log(
    `FLUID_SIMULATION_DEMO_OK finalState=${report.result.finalState} `
    + `completed=${report.result.completed} evidence=${report.evidence} `
    + `verifier=${report.verification?.verifierId}`
  );
}

function runOptimizationDemo() {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'demo-finite-optimization',
    description: 'Optimize a finite candidate set'
  });
  const report = harness.execute({
    plan,
    input: {
      objective: 'minimize',
      candidates: [
        { id: 'baseline', value: 12 },
        { id: 'efficient', value: 4 },
        { id: 'alternate', value: 4 }
      ]
    },
    reproduction: 'node src/cli.mjs optimization-demo'
  });

  console.log(JSON.stringify({
    taskId: report.taskId,
    representation: report.strategy.representation,
    reasoningEngine: report.strategy.reasoningEngine,
    objective: report.result.objective,
    selectedId: report.result.selectedId,
    selectedValue: report.result.selectedValue,
    candidatesEvaluated: report.result.candidatesEvaluated,
    evidence: report.evidence,
    verifierId: report.verification?.verifierId,
    environmentHash: report.environmentHash
  }));
  console.log(
    `FLUID_OPTIMIZATION_DEMO_OK objective=${report.result.objective} `
    + `selected=${report.result.selectedId} evidence=${report.evidence} `
    + `verifier=${report.verification?.verifierId}`
  );
}

function runSearchTreeDemo() {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'demo-finite-search-tree',
    description: 'Explore a finite search tree of candidate branches'
  });
  const report = harness.execute({
    plan,
    input: {
      root: 'root',
      objective: 'maximize',
      nodes: [
        { id: 'root', terminal: false },
        { id: 'baseline', terminal: true, value: 3 },
        { id: 'branch', terminal: false },
        { id: 'winner', terminal: true, value: 9 }
      ],
      edges: [
        { from: 'root', to: 'baseline' },
        { from: 'root', to: 'branch' },
        { from: 'branch', to: 'winner' }
      ]
    },
    reproduction: 'node src/cli.mjs search-tree-demo'
  });

  console.log(JSON.stringify({
    taskId: report.taskId,
    representation: report.strategy.representation,
    reasoningEngine: report.strategy.reasoningEngine,
    executionSubstrate: report.strategy.executionSubstrate,
    selectedId: report.result.selectedId,
    selectedValue: report.result.selectedValue,
    path: report.result.path,
    nodesVisited: report.result.nodesVisited,
    evidence: report.evidence,
    verifierId: report.verification?.verifierId,
    environmentHash: report.environmentHash
  }));
  console.log(
    `FLUID_SEARCH_TREE_DEMO_OK selected=${report.result.selectedId} `
    + `evidence=${report.evidence} verifier=${report.verification?.verifierId}`
  );
}

function runProgramSynthesisDemo() {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'demo-program-synthesis',
    description: 'Implement a function from arithmetic examples'
  });
  const report = harness.execute({
    plan,
    input: {
      variables: ['x'],
      constants: [1],
      operators: ['add'],
      maxDepth: 1,
      examples: [
        { inputs: { x: 2 }, output: 3 },
        { inputs: { x: 4 }, output: 5 }
      ]
    },
    reproduction: 'node src/cli.mjs program-synthesis-demo'
  });

  console.log(JSON.stringify({
    taskId: report.taskId,
    representation: report.strategy.representation,
    reasoningEngine: report.strategy.reasoningEngine,
    executionSubstrate: report.strategy.executionSubstrate,
    expression: report.result.expression,
    expressionKey: report.result.expressionKey,
    depth: report.result.depth,
    examplesChecked: report.result.examplesChecked,
    evidence: report.evidence,
    verifierId: report.verification?.verifierId,
    environmentHash: report.environmentHash
  }));
  console.log(
    `FLUID_PROGRAM_SYNTHESIS_DEMO_OK depth=${report.result.depth} `
    + `evidence=${report.evidence} verifier=${report.verification?.verifierId}`
  );
}

function runModelProviderDemo() {
  const fixturePath = fileURLToPath(new URL('../scripts/fixtures/model-provider.mjs', import.meta.url));
  const provider = new ProcessBackedModelProvider({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'complete',
      timeoutMs: 2000
    }),
    providerId: 'cli-fixture-provider',
    modelId: 'cli-fixture-model'
  });
  const harness = new FluidHarness({
    executorRegistry: new ExecutorRegistry({
      modelProviderExecutor: new ModelProviderExecutor({ provider })
    })
  });
  const plan = harness.plan({
    id: 'demo-model-provider',
    description: 'Explain the architectural tradeoff in plain language'
  });
  const report = harness.execute({
    plan,
    input: { question: 'Why should deterministic work use a deterministic engine?' },
    reproduction: 'node src/cli.mjs model-demo'
  });

  console.log(JSON.stringify({
    taskId: report.taskId,
    representation: report.strategy.representation,
    reasoningEngine: report.strategy.reasoningEngine,
    providerId: report.result.providerId,
    modelId: report.result.modelId,
    source: report.result.source,
    text: report.result.text,
    evidence: report.evidence,
    verifierId: report.verification?.verifierId,
    proof: report.verification?.passed
  }));
  console.log(
    `FLUID_MODEL_DEMO_OK source=${report.result.source} evidence=${report.evidence} `
    + `proof=${report.verification?.passed} verifier=${report.verification?.verifierId}`
  );
}

function evaluationCases() {
  return [
    new EvaluationCase({
      id: 'graph-route',
      domain: 'graph',
      task: {
        id: 'evaluation-graph-route',
        description: 'Find the shortest path through a dependency graph'
      },
      input: {
        nodes: ['A', 'B', 'C', 'D'],
        edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']],
        start: 'A',
        goal: 'D'
      },
      expected: (report) => report.result.path.join('>') === 'A>B>D'
    }),
    new EvaluationCase({
      id: 'constraint-schedule',
      domain: 'constraints',
      task: {
        id: 'evaluation-constraint-schedule',
        description: 'Schedule jobs under resource constraints'
      },
      input: {
        resources: { cpu: 2 },
        jobs: [
          { id: 'build', duration: 2, demand: { cpu: 2 } },
          { id: 'lint', duration: 1, demand: { cpu: 1 } },
          { id: 'test', duration: 1, demand: { cpu: 2 }, prerequisites: ['build'] },
          { id: 'package', duration: 1, demand: { cpu: 1 }, prerequisites: ['lint', 'test'] }
        ]
      },
      expected: (report) => report.result.makespan === 5
    }),
    new EvaluationCase({
      id: 'graph-no-route',
      domain: 'graph',
      productionEligible: false,
      task: {
        id: 'evaluation-graph-no-route',
        description: 'Find the shortest path through a dependency graph'
      },
      input: {
        nodes: ['A', 'B'],
        edges: [],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.found === false
    }),
    new EvaluationCase({
      id: 'malformed-graph-input',
      domain: 'robustness',
      productionEligible: false,
      adversarial: true,
      requiresProof: false,
      task: {
        id: 'evaluation-malformed-graph',
        description: 'Find the shortest path through a dependency graph'
      },
      input: {
        nodes: ['A', 'A'],
        edges: [],
        start: 'A',
        goal: 'A'
      },
      expected: (_report, error) => error?.message.includes('unique')
    }),
    new EvaluationCase({
      id: 'ambiguous-representation',
      domain: 'robustness',
      productionEligible: false,
      adversarial: true,
      requiresProof: false,
      task: {
        id: 'evaluation-ambiguous-task',
        description: 'Graph database'
      },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (_report, error) => error?.message.includes('No executor')
    })
  ];
}

function runEvaluationDemo() {
  const cases = evaluationCases();
  const production = new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId: 'default-kernel',
    cases,
    mode: POLICY_MODES.PRODUCTION,
    budget: new EvaluationBudget({ maxCases: 2 })
  });
  const research = new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId: 'default-kernel',
    cases,
    mode: POLICY_MODES.RESEARCH,
    budget: new EvaluationBudget({ maxCases: 5 })
  });
  const skeptic = new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId: 'default-kernel',
    cases,
    mode: POLICY_MODES.SKEPTIC,
    budget: new EvaluationBudget({ maxCases: 2 })
  });
  const authority = new PromotionAuthority();
  const productionDecision = authority.decide(production);
  const researchDecision = authority.decide(research, { skepticReport: skeptic });

  console.log(JSON.stringify({
    production: {
      attemptedCases: production.attemptedCases,
      successRate: production.successRate,
      complete: production.complete,
      promoted: productionDecision.promoted
    },
    research: {
      attemptedCases: research.attemptedCases,
      successRate: research.successRate,
      provenRate: research.provenRate,
      highSurpriseCases: research.highSurpriseCases,
      transferMatrix: research.transferMatrix,
      promoted: researchDecision.promoted
    },
    skeptic: {
      attemptedCases: skeptic.attemptedCases,
      successRate: skeptic.successRate,
      adversarialSuccessRate: skeptic.adversarialSuccessRate,
      weaknessesExposed: skeptic.weaknessesExposed,
      errors: skeptic.results.filter(({ error }) => error !== null).length,
      complete: skeptic.complete
    }
  }));
  console.log(`FLUID_EVALUATION_OK production=${production.successes}/${production.attemptedCases} research=${research.successes}/${research.attemptedCases} skeptic=${skeptic.successes}/${skeptic.attemptedCases} promoted=${researchDecision.promoted}`);
}

function runSkepticDemo() {
  const cases = evaluationCases();
  const skeptic = new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId: 'default-kernel',
    cases,
    mode: POLICY_MODES.SKEPTIC,
    budget: new EvaluationBudget({ maxCases: 2 })
  });

  console.log(JSON.stringify({
    attemptedCases: skeptic.attemptedCases,
    successRate: skeptic.successRate,
    adversarialSuccessRate: skeptic.adversarialSuccessRate,
    weaknessesExposed: skeptic.weaknessesExposed,
    errors: skeptic.results.filter(({ error }) => error !== null).length,
    complete: skeptic.complete
  }));
  console.log(`FLUID_SKEPTIC_OK cases=${skeptic.successes}/${skeptic.attemptedCases} successRate=${skeptic.successRate} weaknesses=${skeptic.weaknessesExposed}`);
}

function scalingCases() {
  return [
    new EvaluationCase({
      id: 'scaling-deep-graph',
      domain: 'scaling',
      task: {
        id: 'scaling-deep-graph-task',
        description: 'Find the shortest path through a dependency graph'
      },
      input: {
        nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
        edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F']],
        start: 'A',
        goal: 'F'
      },
      expected: (report) => Array.isArray(report?.result?.path)
        && report.result.path.join('>') === 'A>B>C>D>E>F'
    })
  ];
}

function runScalingDemo() {
  const curve = new ScalingRunner().evaluate({
    candidateId: 'default-kernel',
    cases: scalingCases(),
    mode: POLICY_MODES.RESEARCH,
    levels: [
      new ScalingLevel({
        id: 'budget-1',
        computeUnits: 1,
        executionOptions: { maxExpansions: 1 }
      }),
      new ScalingLevel({
        id: 'budget-3',
        computeUnits: 3,
        executionOptions: { maxExpansions: 3 }
      }),
      new ScalingLevel({
        id: 'budget-6',
        computeUnits: 6,
        executionOptions: { maxExpansions: 6 }
      })
    ]
  });

  console.log(JSON.stringify({
    candidateId: curve.candidateId,
    mode: curve.mode,
    points: curve.points.map((point) => ({
      levelId: point.levelId,
      computeUnits: point.computeUnits,
      successRate: point.successRate,
      provenRate: point.provenRate,
      elapsedMs: Number(point.elapsedMs.toFixed(3))
    })),
    frontier: curve.frontier.map(({ levelId }) => levelId)
  }));
  console.log(`FLUID_SCALING_OK levels=${curve.points.length} lowBudget=${curve.points[0].successRate} fullBudget=${curve.points.at(-1).provenRate} frontier=${curve.frontier.map(({ levelId }) => levelId).join(',')}`);
}

function searchCases() {
  return [
    new EvaluationCase({
      id: 'search-graph-route',
      domain: 'graph',
      task: {
        id: 'search-graph-route-task',
        description: 'Find the shortest path through a dependency graph'
      },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.path.join('>') === 'A>B'
    }),
    new EvaluationCase({
      id: 'search-constraint-schedule',
      domain: 'constraints',
      task: {
        id: 'search-constraint-task',
        description: 'Schedule jobs under resource constraints'
      },
      input: {
        resources: { cpu: 1 },
        jobs: [
          { id: 'build', duration: 1, demand: { cpu: 1 } },
          { id: 'test', duration: 1, demand: { cpu: 1 }, prerequisites: ['build'] }
        ]
      },
      expected: (report) => report.result.makespan === 2
    }),
    new EvaluationCase({
      id: 'search-malformed-input',
      domain: 'robustness',
      productionEligible: false,
      adversarial: true,
      requiresProof: false,
      task: {
        id: 'search-malformed-task',
        description: 'Find the shortest path through a dependency graph'
      },
      input: {
        nodes: ['A', 'A'],
        edges: [],
        start: 'A',
        goal: 'A'
      },
      expected: (_report, error) => error?.message.includes('unique')
    }),
    new EvaluationCase({
      id: 'search-ambiguous-input',
      domain: 'robustness',
      productionEligible: false,
      adversarial: true,
      requiresProof: false,
      task: { id: 'search-ambiguous-task', description: 'Graph database' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (_report, error) => error?.message.includes('No executor')
    })
  ];
}

function runSearchDemo() {
  const report = new RepresentationSearchRunner().evaluate({
    candidates: searchCandidates(),
    cases: searchCases(),
    productionBudget: new EvaluationBudget({ maxCases: 4 }),
    researchBudget: new EvaluationBudget({ maxCases: 4 }),
    skepticBudget: new EvaluationBudget({ maxCases: 2 })
  });
  const adoptedHarness = new FluidHarness({ selector: selectorFromPromotedSearch(report) });
  const adoptedPlan = adoptedHarness.plan({
    id: 'adopted-search-task',
    description: 'Find a graph path'
  });
  const adoptedReport = adoptedHarness.execute({
    plan: adoptedPlan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    reproduction: 'node src/cli.mjs search-demo'
  });

  console.log(JSON.stringify({
    winner: report.winner.candidateId,
    promoted: report.promoted?.candidateId ?? null,
    allAuditsValid: report.allAuditsValid,
    adoptedRepresentation: adoptedReport.strategy.representation,
    adoptedEvidence: adoptedReport.evidence,
    candidates: report.results.map((result) => ({
      candidateId: result.candidateId,
      promoted: result.promoted,
      researchSuccessRate: result.fitness.researchSuccessRate,
      researchProvenRate: result.fitness.researchProvenRate,
      skepticSuccessRate: result.fitness.skepticSuccessRate,
      skepticWeaknessesExposed: result.fitness.skepticWeaknessesExposed,
      transferSuccessRate: result.fitness.transferSuccessRate,
      error: result.error
    }))
  }));
  console.log(`FLUID_SEARCH_OK winner=${report.winner.candidateId} promoted=${report.promoted?.candidateId ?? 'none'} applied=${adoptedReport.strategy.representation} evidence=${adoptedReport.evidence} candidates=${report.results.length} audits=${report.allAuditsValid}`);
}

function searchCandidates() {
  return [
    new RepresentationCandidate({
      id: 'graph-biased',
      description: 'Always chooses graph representation',
      selectorFactory: () => ({ select: () => REPRESENTATIONS.GRAPH })
    }),
    new RepresentationCandidate({
      id: 'default-heuristic',
      description: 'Uses scored representation selection',
      selectorFactory: () => new HeuristicRepresentationSelector()
    })
  ];
}

function runEvolutionDemo() {
  const cases = searchCases();
  const candidates = searchCandidates();
  const evaluateSearch = () => new RepresentationSearchRunner().evaluate({
    candidates,
    cases,
    productionBudget: new EvaluationBudget({ maxCases: 4 }),
    researchBudget: new EvaluationBudget({ maxCases: 4 }),
    skepticBudget: new EvaluationBudget({ maxCases: 2 })
  });
  const searchReport = evaluateSearch();
  const reproductionReport = evaluateSearch();
  const authority = new EvolutionAuthority();
  const skippedProposal = authority.propose({
    id: 'skip-to-modules',
    level: MUTATION_LEVELS.MODULES,
    searchReport,
    baselineCandidateId: 'graph-biased',
    candidateCandidateId: 'default-heuristic',
    reproductionReport
  });
  const skipped = authority.approve(skippedProposal);
  const promptProposal = authority.propose({
    id: 'promote-heuristic-prompt',
    level: MUTATION_LEVELS.PROMPTS,
    searchReport,
    baselineCandidateId: 'graph-biased',
    candidateCandidateId: 'default-heuristic',
    reproductionReport
  });
  const approved = authority.approve(promptProposal);

  console.log(JSON.stringify({
    skipped: {
      approved: skipped.approved,
      reasons: skipped.reasons
    },
    approved: {
      approved: approved.approved,
      level: approved.level,
      permitTrusted: isTrustedMutationPermit(approved.permit)
    },
    unlockedThrough: authority.unlockedThrough,
    history: authority.history
  }));
  console.log(`FLUID_EVOLUTION_OK unlocked=${authority.unlockedThrough} skipped=${skipped.approved} permit=${isTrustedMutationPermit(approved.permit)}`);
}

function runCycleDemo() {
  const cycle = new CognitiveCycleRunner().run({
    task: {
      id: 'full-cycle-demo',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    reproduction: 'node src/cli.mjs cycle-demo',
    research: {
      candidates: searchCandidates(),
      cases: searchCases(),
      productionBudget: new EvaluationBudget({ maxCases: 4 }),
      researchBudget: new EvaluationBudget({ maxCases: 4 }),
      skepticBudget: new EvaluationBudget({ maxCases: 2 })
    }
  });

  console.log(JSON.stringify({
    taskId: cycle.taskId,
    stages: Object.keys(cycle.stages),
    representation: cycle.stages.represent.representation,
    evidence: cycle.stages.verify.evidence,
    surpriseBand: cycle.stages.learn.surpriseBand,
    worldModelHistoryLength: cycle.stages.learn.worldModelHistoryLength,
    researchWinner: cycle.stages.question.winner,
    promotedCandidate: cycle.stages.preserve.promotedCandidate,
    coreAuditValid: cycle.stages.preserve.coreAuditValid,
    researchAuditValid: cycle.stages.preserve.researchAuditValid
  }));
  console.log(`FLUID_CYCLE_OK stages=${Object.keys(cycle.stages).length} representation=${cycle.stages.represent.representation} evidence=${cycle.stages.verify.evidence} research=${cycle.stages.question.winner} promoted=${cycle.stages.preserve.promotedCandidate} preserved=${cycle.stages.preserve.productionPreserved}`);
}

function runCuriosityDemo() {
  const runner = new CognitiveCycleRunner();
  const highSurprise = runner.run({
    task: {
      id: 'curiosity-high-surprise',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [],
      start: 'A',
      goal: 'B'
    },
    reproduction: 'node src/cli.mjs curiosity-demo'
  });
  const weakEvidence = runner.run({
    task: {
      id: 'curiosity-weak-evidence',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    executionOptions: { maxExpansions: 1 },
    reproduction: 'node src/cli.mjs curiosity-demo'
  });
  const questions = [highSurprise, weakEvidence].map((cycle) => ({
    evidence: cycle.stages.verify.evidence,
    surpriseBand: cycle.stages.learn.surpriseBand,
    requested: cycle.stages.question.requested,
    reason: cycle.stages.question.reason,
    researchRequired: cycle.stages.question.researchRequired
  }));

  console.log(JSON.stringify({ questions }));
  console.log(`FLUID_CURIOSITY_OK high=${questions[0].reason} weak=${questions[1].reason} pending=${questions.every(({ researchRequired }) => researchRequired)}`);
}

function runResearchSchedulerDemo() {
  const core = new ConstitutionalCore();
  for (const suffix of ['first', 'second']) {
    const task = {
      id: `research-scheduler-${suffix}`,
      description: 'Find the shortest path through a dependency graph'
    };
    const plan = core.plan(task);
    const report = core.execute({
      plan,
      policyMode: POLICY_MODES.RESEARCH,
      input: {
        nodes: ['A', 'B', 'C'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'C'
      },
      reproduction: 'node src/cli.mjs research-scheduler-demo'
    });
    core.recordQuestion({
      taskId: task.id,
      policyMode: POLICY_MODES.RESEARCH,
      question: questionFor({ actionReport: report }),
      actionReport: report
    });
  }

  const schedule = new BoundedResearchScheduler().schedule({
    pendingResearch: core.researchQueue,
    maxItems: 1
  });
  console.log(JSON.stringify({
    sourceCount: schedule.sourceCount,
    scheduledCount: schedule.scheduledCount,
    complete: schedule.complete,
    dataOnly: schedule.dataOnly,
    entries: schedule.entries
  }));
  console.log(
    `FLUID_RESEARCH_SCHEDULER_OK source=${schedule.sourceCount} `
    + `scheduled=${schedule.scheduledCount} first=${schedule.entries[0].taskId} `
    + `dataOnly=${schedule.dataOnly} pending=${core.researchQueue.length}`
  );
}

function runLearningDemo() {
  const harness = new FluidHarness();
  const task = {
    id: 'learning-demo-task',
    description: 'Find a graph path'
  };
  const input = {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
  const firstPlan = harness.plan(task);
  const first = harness.execute({ plan: firstPlan, input });
  const limitedPlan = harness.plan(task);
  const limited = harness.execute({
    plan: limitedPlan,
    input,
    executionOptions: { maxExpansions: 1 }
  });
  const recoveredPlan = harness.plan(task);
  const recovered = harness.execute({ plan: recoveredPlan, input });
  const profile = recovered.strategyProfile;

  console.log(JSON.stringify({
    evidence: [first.evidence, limited.evidence, recovered.evidence],
    surpriseBands: [first.surpriseBand, limited.surpriseBand, recovered.surpriseBand],
    priorAttempts: [
      firstPlan.strategyProfile.attempts,
      limitedPlan.strategyProfile.attempts,
      recoveredPlan.strategyProfile.attempts
    ],
    profile
  }));
  console.log(`FLUID_LEARNING_OK prior=${[firstPlan, limitedPlan, recoveredPlan].map(({ strategyProfile }) => strategyProfile.attempts).join(',')} attempts=${profile.attempts} errors=${profile.predictionErrors} proven=${profile.provenCases} observed=${profile.observedCases} accuracy=${profile.predictionAccuracy}`);
}

function runFailureDemo() {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'failure-demo-task',
    description: 'Find a graph path'
  });
  let failureMessage = null;
  try {
    harness.execute({
      plan,
      input: {
        nodes: ['A'],
        edges: [],
        start: 'A',
        goal: 'B'
      },
      reproduction: 'node src/cli.mjs failure-demo'
    });
  } catch (error) {
    failureMessage = isInstanceOf(error, Error) ? error.message : String(error);
  }
  const signal = harness.worldModel.history.at(-1);
  const profile = harness.worldModel.profile(plan.strategy.reasoningEngine);

  console.log(JSON.stringify({
    failureMessage,
    evidence: signal.evidence,
    surpriseBand: signal.surpriseBand,
    failure: signal.failure,
    profile
  }));
  console.log(`FLUID_FAILURE_OK evidence=${signal.evidence} surprise=${signal.surpriseBand} failures=${profile.failureCases} rethrown=${failureMessage !== null}`);
}

function runEvidenceLedgerDemo() {
  const sourceCore = new ConstitutionalCore();
  const plan = sourceCore.plan({
    id: 'evidence-ledger-demo-task',
    description: 'Find a graph path'
  });
  const report = sourceCore.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    reproduction: 'node src/cli.mjs ledger-demo'
  });
  const ledger = new EvidenceLedger();
  ledger.appendAction(report);
  ledger.appendCore(sourceCore);
  const serialized = ledger.serialize();
  const restored = EvidenceLedger.fromSerialized(serialized);
  const restoredModel = restored.restoreWorldModel();
  const resumedHarness = new FluidHarness({ worldModel: restoredModel });
  const resumedCore = new ConstitutionalCore({ harness: resumedHarness });
  const resumedPlan = resumedCore.plan({
    id: 'evidence-ledger-demo-resumed-task',
    description: 'Find a graph path'
  });
  const resumedReport = resumedCore.execute({
    plan: resumedPlan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    reproduction: 'node src/cli.mjs ledger-demo resumed'
  });
  console.log(JSON.stringify({
    entries: restored.length,
    evidence: restored.records[0].payload.evidence,
    verified: restored.verify(),
    roundTrip: restored.serialize() === serialized,
    restoredHistory: restoredModel.history.length,
    resumedPriorAttempts: resumedPlan.strategyProfile.attempts,
    resumedEvidence: resumedReport.evidence
  }));
  console.log(
    `FLUID_LEDGER_OK entries=${restored.length} evidence=${restored.records[0].payload.evidence} `
    + `verified=${restored.verify()} roundTrip=${restored.serialize() === serialized} `
    + `memory=${restoredModel.history.length} prior=${resumedPlan.strategyProfile.attempts} `
    + `fresh=${resumedReport.evidence}`
  );
}

function runAgentDemo() {
  const report = new BoundedAgentRunner().run({
    episodes: [
      {
        task: { id: 'agent-episode-success', description: 'Find a graph path' },
        input: {
          nodes: ['A', 'B'],
          edges: [['A', 'B']],
          start: 'A',
          goal: 'B'
        }
      },
      {
        task: { id: 'agent-episode-surprise', description: 'Find a graph path' },
        input: {
          nodes: ['A', 'B'],
          edges: [],
          start: 'A',
          goal: 'B'
        }
      },
      {
        task: { id: 'agent-episode-after-stop', description: 'Find a graph path' },
        input: {
          nodes: ['A', 'B'],
          edges: [['A', 'B']],
          start: 'A',
          goal: 'B'
        }
      }
    ]
  });
  console.log(JSON.stringify({
    completed: report.completed,
    attemptedEpisodes: report.attemptedEpisodes,
    stopReason: report.stopReason,
    cycleCount: report.cycles.length,
    pendingResearch: report.pendingResearch.length,
    auditValid: report.auditValid
  }));
  console.log(
    `FLUID_AGENT_OK completed=${report.completed} episodes=${report.attemptedEpisodes} `
    + `stop=${report.stopReason} pendingResearch=${report.pendingResearch.length} audit=${report.auditValid}`
  );
}

if (process.argv[2] === 'demo') {
  runDemo();
} else if (process.argv[2] === 'constraint-demo') {
  runConstraintDemo();
} else if (process.argv[2] === 'array-demo') {
  runArrayDemo();
} else if (process.argv[2] === 'database-demo') {
  runDatabaseQueryDemo();
} else if (process.argv[2] === 'theorem-demo') {
  runTheoremDemo();
} else if (process.argv[2] === 'bayesian-demo') {
  runBayesianDemo();
} else if (process.argv[2] === 'simulation-demo') {
  runSimulationDemo();
} else if (process.argv[2] === 'optimization-demo') {
  runOptimizationDemo();
} else if (process.argv[2] === 'search-tree-demo') {
  runSearchTreeDemo();
} else if (process.argv[2] === 'program-synthesis-demo') {
  runProgramSynthesisDemo();
} else if (process.argv[2] === 'model-demo') {
  runModelProviderDemo();
} else if (process.argv[2] === 'evaluate-demo') {
  runEvaluationDemo();
} else if (process.argv[2] === 'skeptic-demo') {
  runSkepticDemo();
} else if (process.argv[2] === 'scale-demo') {
  runScalingDemo();
} else if (process.argv[2] === 'search-demo') {
  runSearchDemo();
} else if (process.argv[2] === 'evolution-demo') {
  runEvolutionDemo();
} else if (process.argv[2] === 'cycle-demo') {
  runCycleDemo();
} else if (process.argv[2] === 'curiosity-demo') {
  runCuriosityDemo();
} else if (process.argv[2] === 'research-scheduler-demo') {
  runResearchSchedulerDemo();
} else if (process.argv[2] === 'learning-demo') {
  runLearningDemo();
} else if (process.argv[2] === 'failure-demo') {
  runFailureDemo();
} else if (process.argv[2] === 'ledger-demo') {
  runEvidenceLedgerDemo();
} else if (process.argv[2] === 'agent-demo') {
  runAgentDemo();
} else {
  console.error('Usage: node src/cli.mjs demo|array-demo|database-demo|theorem-demo|bayesian-demo|simulation-demo|optimization-demo|search-tree-demo|program-synthesis-demo|model-demo|constraint-demo|evaluate-demo|skeptic-demo|scale-demo|search-demo|evolution-demo|cycle-demo|curiosity-demo|research-scheduler-demo|learning-demo|failure-demo|ledger-demo|agent-demo');
  process.exitCode = 1;
}
