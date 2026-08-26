import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { EVIDENCE_LEVELS, promoteEvidence } from '../src/evidence.mjs';
import { ActionReport } from '../src/action.mjs';
import {
  Constitution,
  ConstitutionalCore,
  CORE_EVENTS
} from '../src/constitution.mjs';
import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES,
  PromotionAuthority
} from '../src/evaluation.mjs';
import {
  ExecutorRegistry,
  GraphPathExecutor,
  isTrustedExecution
} from '../src/executor.mjs';
import {
  ModelProviderExecutor,
  ProcessBackedModelProvider
} from '../src/model-provider.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import {
  FluidHarness,
  isTrustedActionReport,
  isTrustedPlan,
  Plan
} from '../src/harness.mjs';
import {
  isTrustedScalingCurve,
  ScalingRunner
} from '../src/scaling.mjs';
import {
  isTrustedSearchReport,
  RepresentationCandidate,
  RepresentationSearchRunner,
  selectorFromPromotedSearch
} from '../src/search.mjs';
import {
  EvolutionAuthority,
  isTrustedMutationProposal,
  isTrustedMutationPermit,
  MUTATION_LEVELS
} from '../src/evolution.mjs';
import {
  CognitiveCycleReport,
  CognitiveCycleRunner,
  isTrustedCycleReport
} from '../src/cycle.mjs';
import {
  AGENT_RESEARCH_BATCH_STATUSES,
  BoundedAgentRunner,
  isTrustedAgentResearchBatchResolutionReport
} from '../src/agent.mjs';
import {
  isTrustedQuestionDecision,
  QUESTION_REASONS,
  QuestionDecision,
  questionFor
} from '../src/curiosity.mjs';
import {
  BoundedResearchScheduler,
  isTrustedResearchSchedule
} from '../src/research-scheduler.mjs';
import {
  BoundedStructuredMemory,
  StructuredMemoryEntry,
  isTrustedBoundedStructuredMemory,
  memoryFromAgentRun
} from '../src/memory.mjs';
import {
  EXECUTION_SUBSTRATES,
  REASONING_ENGINES,
  REPRESENTATIONS,
  Task,
  HeuristicRepresentationSelector,
  strategyFor
} from '../src/representation.mjs';
import {
  Observation,
  Prediction,
  SURPRISE_BANDS,
  WorldModel,
  surpriseFromLikelihood
} from '../src/world-model.mjs';
import { VerifierRegistry, verifyGraphExecution } from '../src/verification.mjs';

test('selects a graph representation and deterministic graph engine', () => {
  const task = new Task({ id: 'graph-1', description: 'Resolve a dependency graph traversal' });
  const selection = new HeuristicRepresentationSelector().select(task);
  const strategy = strategyFor(task);

  assert.equal(selection.representation, REPRESENTATIONS.GRAPH);
  assert.equal(selection.ambiguous, false);
  assert.equal(strategy.representation, REPRESENTATIONS.GRAPH);
  assert.equal(strategy.reasoningEngine, REASONING_ENGINES.GRAPH_ALGORITHMS);
  assert.equal(strategy.executionSubstrate, EXECUTION_SUBSTRATES.DETERMINISTIC_KERNEL);
});

test('scores coding signals above incidental Node.js wording', () => {
  const task = new Task({
    id: 'code-1',
    description: 'Implement a Node.js function for a repository API bug'
  });
  const selection = new HeuristicRepresentationSelector().select(task);

  assert.equal(selection.representation, REPRESENTATIONS.PROGRAM_SYNTHESIS);
  assert.equal(selection.ambiguous, false);
});

test('synthesizes and independently verifies a bounded arithmetic program', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'program-synthesis-1',
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
        { inputs: { x: 1 }, output: 2 },
        { inputs: { x: 2 }, output: 3 }
      ]
    }
  });

  assert.equal(plan.strategy.representation, REPRESENTATIONS.PROGRAM_SYNTHESIS);
  assert.equal(report.result.expression.op, 'add');
  assert.equal(report.result.depth, 1);
  assert.equal(report.result.examplesChecked, 2);
  assert.equal(report.result.synthesisComplete, true);
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.verification.verifierId, 'finite-program-synthesis-verifier/v1');
});

test('selects database representation when dependency and query signals coexist', () => {
  const task = new Task({ id: 'database-1', description: 'Query the dependency database' });
  const selection = new HeuristicRepresentationSelector().select(task);

  assert.equal(selection.representation, REPRESENTATIONS.DATABASE_QUERY);
  assert.equal(selection.ambiguous, false);
});

test('falls back to natural language for unknown or tied representations', () => {
  const selector = new HeuristicRepresentationSelector();
  const unknown = selector.select(new Task({
    id: 'plain-1',
    description: 'Explain this unfamiliar product requirement'
  }));
  const tied = selector.select(new Task({
    id: 'ambiguous-1',
    description: 'Graph database'
  }));

  assert.equal(unknown.representation, REPRESENTATIONS.NATURAL_LANGUAGE);
  assert.equal(unknown.confidence, 0);
  assert.equal(tied.representation, REPRESENTATIONS.NATURAL_LANGUAGE);
  assert.equal(tied.ambiguous, true);
});

test('computes surprise as negative log likelihood and records model history', () => {
  assert.ok(Math.abs(surpriseFromLikelihood(0.25) - Math.log(4)) < Number.EPSILON);

  const model = new WorldModel();
  const prediction = new Prediction({
    expectedObservation: 'expected',
    expectedLikelihood: 0.8,
    mismatchLikelihood: 0.05,
    strategyKey: 'test-engine'
  });
  const expected = model.measure(prediction, new Observation({ actualObservation: 'expected' }));
  const unexpected = model.measure(prediction, new Observation({ actualObservation: 'unexpected' }));
  const updated = model.update(expected);

  assert.equal(expected.predictionError, false);
  assert.equal(expected.surpriseBand, SURPRISE_BANDS.LOW);
  assert.equal(unexpected.predictionError, true);
  assert.equal(unexpected.surpriseBand, SURPRISE_BANDS.HIGH);
  assert.ok(unexpected.surpriseNats > expected.surpriseNats);
  assert.equal(updated.history.length, 1);
  assert.equal(updated.history[0].evidence, EVIDENCE_LEVELS.BELIEVED);
  assert.equal(updated.history[0].verified, false);
  const profile = updated.profile('test-engine');
  assert.equal(profile.attempts, 1);
  assert.equal(profile.predictionErrors, 0);
  assert.equal(profile.predictionAccuracy, 1);
  assert.equal(profile.evidenceCounts[EVIDENCE_LEVELS.BELIEVED], 1);
  assert.equal(profile.evidenceCounts[EVIDENCE_LEVELS.PROVEN], 0);
  assert.ok(Math.abs(profile.calibrationGap - 0.2) < Number.EPSILON);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.evidenceCounts), true);
});

test('normalizes learning evidence and rejects forged verification state', () => {
  const model = new WorldModel();
  const prediction = new Prediction({
    expectedObservation: 'expected',
    strategyKey: 'learning-boundary'
  });
  const signal = model.measure(prediction, new Observation({ actualObservation: 'expected' }));
  const defaulted = model.update(signal);

  assert.equal(defaulted.history[0].evidence, EVIDENCE_LEVELS.BELIEVED);
  assert.equal(defaulted.history[0].verified, false);
  assert.throws(
    () => model.update({ ...signal, evidence: 'FORGED' }),
    /known evidence level/
  );
  assert.throws(
    () => model.update({
      ...signal,
      evidence: EVIDENCE_LEVELS.PROVEN,
      verified: false
    }),
    /must match evidence level/
  );
  assert.throws(
    () => model.update({
      ...signal,
      evidence: EVIDENCE_LEVELS.PROVEN,
      verified: true
    }),
    /trusted verification/
  );
});

test('world-model updates reject trusted verification replay and mismatched observations', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({ id: 'learning-verification-replay', description: 'Find a graph path' });
  const input = {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
  const execution = harness.executorRegistry.execute({
    task: plan.task,
    strategy: plan.strategy,
    input
  });
  const verification = harness.verifierRegistry.verify(execution);
  const matchingPrediction = new Prediction({
    expectedObservation: execution.observation,
    strategyKey: execution.reasoningEngine
  });
  const matchingModel = new WorldModel();
  const matchingSignal = matchingModel.measure(
    matchingPrediction,
    new Observation({ actualObservation: execution.observation })
  );

  assert.throws(
    () => matchingModel.update({
      ...matchingSignal,
      evidence: EVIDENCE_LEVELS.PROVEN,
      verified: true,
      verification
    }),
    /current execution/
  );

  const unrelatedModel = new WorldModel();
  const unrelatedSignal = unrelatedModel.measure(
    new Prediction({
      expectedObservation: 'unrelated observation',
      strategyKey: execution.reasoningEngine
    }),
    new Observation({ actualObservation: 'unrelated observation' })
  );
  assert.throws(
    () => unrelatedModel.update({
      ...unrelatedSignal,
      evidence: EVIDENCE_LEVELS.PROVEN,
      verified: true,
      verification,
      verificationExecution: execution
    }),
    /current execution/
  );

  assert.equal(matchingModel.update({
    ...matchingSignal,
    evidence: EVIDENCE_LEVELS.PROVEN,
    verified: true,
    verification,
    verificationExecution: execution
  }).history[0].evidence, EVIDENCE_LEVELS.PROVEN);

  const replayModel = new WorldModel();
  assert.throws(
    () => replayModel.update({
      ...matchingSignal,
      evidence: EVIDENCE_LEVELS.PROVEN,
      verified: true,
      verification,
      verificationExecution: execution
    }),
    /already-consumed execution/
  );
});

test('turns high surprise and weak evidence into immutable research questions', () => {
  const highSurprise = questionFor({
    actionReport: {
      evidence: EVIDENCE_LEVELS.PROVEN,
      surpriseBand: SURPRISE_BANDS.HIGH
    }
  });
  const weakEvidence = questionFor({
    actionReport: {
      evidence: EVIDENCE_LEVELS.OBSERVED,
      surpriseBand: SURPRISE_BANDS.LOW
    }
  });
  const settled = questionFor({
    actionReport: {
      evidence: EVIDENCE_LEVELS.PROVEN,
      surpriseBand: SURPRISE_BANDS.LOW
    }
  });
  const researched = questionFor({
    actionReport: {
      evidence: EVIDENCE_LEVELS.PROVEN,
      surpriseBand: SURPRISE_BANDS.LOW
    },
    researchCompleted: true
  });

  assert.equal(highSurprise.reason, QUESTION_REASONS.HIGH_SURPRISE);
  assert.equal(highSurprise.requested, true);
  assert.equal(highSurprise.researchRequired, true);
  assert.equal(weakEvidence.reason, QUESTION_REASONS.INSUFFICIENT_EVIDENCE);
  assert.equal(weakEvidence.requested, true);
  assert.equal(weakEvidence.researchRequired, true);
  assert.equal(settled.reason, QUESTION_REASONS.NONE);
  assert.equal(settled.requested, false);
  assert.equal(researched.reason, QUESTION_REASONS.EXPLICIT_RESEARCH);
  assert.equal(researched.researchRequired, false);
  assert.equal(Object.isFrozen(highSurprise), true);
});

test('only the question policy factory produces trusted decisions', () => {
  const core = new ConstitutionalCore();
  const plan = core.plan({ id: 'question-source', description: 'Find a graph path' });
  const actionReport = core.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [],
      start: 'A',
      goal: 'B'
    }
  });
  const forged = new QuestionDecision({ actionReport });
  const trusted = questionFor({ actionReport });

  assert.equal(isTrustedQuestionDecision(forged), false);
  assert.equal(isTrustedQuestionDecision(trusted), true);
  assert.throws(
    () => core.recordQuestion({
      taskId: actionReport.taskId,
      actionReport,
      question: forged
    }),
    /trusted policy/
  );
  core.recordQuestion({
    taskId: actionReport.taskId,
    actionReport,
    question: trusted
  });
  assert.equal(core.verifyAudit(), true);
});

test('schedules pending research by surprise without restoring action authority', () => {
  const scheduler = new BoundedResearchScheduler();
  const schedule = scheduler.schedule({
    pendingResearch: [
      {
        actionNumber: 2,
        taskId: 'low-priority-research',
        policyMode: POLICY_MODES.RESEARCH,
        reason: QUESTION_REASONS.INSUFFICIENT_EVIDENCE,
        evidence: EVIDENCE_LEVELS.OBSERVED,
        surpriseBand: SURPRISE_BANDS.LOW,
        researchRequested: true,
        researchRequired: true,
        action: {
          strategyKey: 'engine',
          predictionError: false,
          surpriseNats: 0.2,
          evidence: EVIDENCE_LEVELS.OBSERVED,
          environmentHash: 'sha256:low'
        }
      },
      {
        actionNumber: 1,
        taskId: 'high-priority-research',
        policyMode: POLICY_MODES.RESEARCH,
        reason: QUESTION_REASONS.HIGH_SURPRISE,
        evidence: EVIDENCE_LEVELS.PROVEN,
        surpriseBand: SURPRISE_BANDS.HIGH,
        researchRequested: true,
        researchRequired: true,
        action: {
          strategyKey: 'engine',
          predictionError: true,
          surpriseNats: 2,
          evidence: EVIDENCE_LEVELS.PROVEN,
          environmentHash: 'sha256:high'
        }
      }
    ],
    maxItems: 1
  });

  assert.equal(isTrustedResearchSchedule(schedule), true);
  assert.equal(schedule.complete, false);
  assert.equal(schedule.dataOnly, true);
  assert.equal(schedule.entries[0].taskId, 'high-priority-research');
  assert.equal(schedule.entries[0].priority, 3);
  assert.equal(Object.hasOwn(schedule.entries[0], 'actionReport'), false);
  assert.equal(Object.isFrozen(schedule), true);
});

test('resolves a bounded research schedule in rank order with a stop receipt', () => {
  const researchSpec = (prefix, maxCases = 1) => ({
    candidates: [new RepresentationCandidate({
      id: `${prefix}-candidate`,
      selectorFactory: () => new HeuristicRepresentationSelector()
    })],
    cases: [new EvaluationCase({
      id: `${prefix}-case`,
      domain: 'graph',
      adversarial: true,
      task: { id: `${prefix}-task`, description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.path.join('>') === 'A>B'
    })],
    productionBudget: new EvaluationBudget({ maxCases }),
    researchBudget: new EvaluationBudget({ maxCases }),
    skepticBudget: new EvaluationBudget({ maxCases })
  });
  const runner = new BoundedAgentRunner();
  const runReport = runner.run({
    episodes: [
      {
        task: { id: 'batch-research-first', description: 'Find a graph path' },
        input: { nodes: ['A', 'B'], edges: [], start: 'A', goal: 'B' }
      },
      {
        task: { id: 'batch-research-second', description: 'Find a graph path' },
        input: { nodes: ['A', 'B'], edges: [], start: 'A', goal: 'B' }
      }
    ],
    stopOnResearchRequired: false
  });
  const schedule = runner.scheduleResearch({ maxItems: 2 });
  const batch = runner.resolveScheduledResearch({
    runReport,
    schedule,
    researches: [
      { taskId: 'batch-research-first', research: researchSpec('batch-research-first') },
      { taskId: 'batch-research-second', research: researchSpec('batch-research-second') }
    ]
  });

  assert.equal(isTrustedAgentResearchBatchResolutionReport(batch), true);
  assert.equal(batch.status, AGENT_RESEARCH_BATCH_STATUSES.COMPLETED);
  assert.equal(batch.complete, true);
  assert.deepEqual(batch.taskIds, [
    'batch-research-first',
    'batch-research-second'
  ]);
  assert.equal(batch.attemptedCount, 2);
  assert.equal(batch.resolvedCount, 2);
  assert.equal(batch.pendingResearch.length, 0);
  assert.equal(batch.auditValid, true);
  assert.equal(Object.isFrozen(batch), true);
});

test('retrieves immutable structured memory without restoring action authority', () => {
  const runner = new BoundedAgentRunner();
  const runReport = runner.run({
    episodes: [
      {
        task: { id: 'memory-unit-success', description: 'Find a graph path' },
        input: {
          nodes: ['A', 'B'],
          edges: [['A', 'B']],
          start: 'A',
          goal: 'B'
        }
      },
      {
        task: { id: 'memory-unit-surprise', description: 'Find a graph path' },
        input: {
          nodes: ['A', 'B'],
          edges: [],
          start: 'A',
          goal: 'B'
        }
      }
    ],
    stopOnResearchRequired: false
  });
  const memory = memoryFromAgentRun({
    runReport,
    idPrefix: 'memory-unit'
  });
  assert.equal(isTrustedBoundedStructuredMemory(memory), true);
  assert.equal(memory.size, 2);
  const highSurprise = memory.query({
    keywords: ['GRAPH-ALGORITHMS'],
    surpriseBand: SURPRISE_BANDS.HIGH,
    limit: 2
  });
  assert.equal(highSurprise.totalMatches, 1);
  assert.equal(highSurprise.results[0].taskId, 'memory-unit-surprise');
  assert.equal(highSurprise.results[0].dataOnly, true);
  assert.equal(highSurprise.results[0].historicalOnly, true);
  assert.equal(Object.hasOwn(highSurprise.results[0], 'actionReport'), false);
  assert.equal(Object.isFrozen(highSurprise), true);

  const extended = memory.add(new StructuredMemoryEntry({
    id: 'memory-unit-caller',
    taskId: 'memory-unit-caller',
    description: 'Compare a finite theorem result',
    strategyKey: 'theorem-prover',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0.2,
    predictionError: false,
    source: 'CALLER',
    keywords: ['theorem']
  }));
  assert.equal(memory.size, 2);
  assert.equal(extended.size, 3);
  assert.equal(extended.dataOnly, true);
  assert.equal(extended.historicalOnly, true);
  assert.throws(
    () => new BoundedStructuredMemory({
      entries: [extended.entries[0], extended.entries[0]]
    }),
    /duplicated/
  );
});

test('only harness-created plans can cross execution boundaries', () => {
  const harness = new FluidHarness();
  const trustedPlan = harness.plan({ id: 'trusted-plan', description: 'Find a graph path' });
  const forgedPlan = new Plan({
    task: trustedPlan.task,
    strategy: trustedPlan.strategy,
    prediction: trustedPlan.prediction,
    strategyProfile: trustedPlan.strategyProfile
  });

  assert.equal(isTrustedPlan(trustedPlan), true);
  assert.equal(isTrustedPlan(forgedPlan), false);
  assert.throws(
    () => harness.execute({
      plan: forgedPlan,
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      }
    }),
    /trusted Plan/
  );
  const core = new ConstitutionalCore();
  assert.throws(
    () => core.execute({
      plan: forgedPlan,
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      }
    }),
    /trusted Plan/
  );
});

test('constitutional execution rejects forged action reports', () => {
  class ForgingHarness extends FluidHarness {
    execute({ plan }) {
      return new ActionReport({
        task: plan.task,
        strategy: plan.strategy,
        prediction: plan.prediction,
        observation: new Observation({ actualObservation: 'graph path resolved' }),
        result: { path: ['A', 'B'] },
        signal: {
          predictionError: false,
          surpriseNats: 0,
          surpriseBand: SURPRISE_BANDS.LOW
        }
      });
    }
  }

  const harness = new ForgingHarness();
  const core = new ConstitutionalCore({ harness });
  const plan = core.plan({ id: 'forged-action-report', description: 'Find a graph path' });

  let forgedReport;
  const originalExecute = harness.execute;
  harness.execute = ({ plan: currentPlan }) => {
    forgedReport = originalExecute({ plan: currentPlan });
    return forgedReport;
  };

  assert.throws(
    () => core.execute({
      plan,
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      }
    }),
    /trusted action report/
  );
  assert.equal(isTrustedActionReport(forgedReport), false);
  assert.equal(core.auditTrail.at(-1).event, CORE_EVENTS.ACTION_FAILED);
  assert.equal(core.verifyAudit(), true);
});

test('constitutional execution rejects action reports replayed from another harness', () => {
  const donor = new FluidHarness();
  const donorPlan = donor.plan({ id: 'donor-report', description: 'Find a graph path' });
  const donorReport = donor.execute({
    plan: donorPlan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  });

  class ReplayingHarness extends FluidHarness {
    execute() {
      return donorReport;
    }
  }

  const harness = new ReplayingHarness();
  const core = new ConstitutionalCore({ harness });
  const plan = core.plan({ id: 'replay-report', description: 'Find a graph path' });

  assert.equal(isTrustedActionReport(donorReport, donor), true);
  assert.equal(isTrustedActionReport(donorReport, harness), false);
  assert.throws(
    () => core.execute({
      plan,
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      }
    }),
    /trusted action report/
  );
  assert.equal(core.auditTrail.at(-1).event, CORE_EVENTS.ACTION_FAILED);
  assert.equal(core.verifyAudit(), true);
});

test('constitutional execution rejects same-harness action reports mismatching the current plan', () => {
  const graphInput = () => ({
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  });
  const harness = new FluidHarness();
  const donorPlan = harness.plan({ id: 'action-report-donor', description: 'Find a graph path' });
  const donorReport = harness.execute({ plan: donorPlan, input: graphInput() });
  const core = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 }),
    harness
  });
  const targetPlan = core.plan({ id: 'action-report-target', description: 'Find a graph path' });
  harness.execute = () => donorReport;

  assert.throws(
    () => core.execute({ plan: targetPlan, input: graphInput() }),
    /matching the current plan/
  );
  assert.equal(core.auditTrail.at(-1).event, CORE_EVENTS.ACTION_FAILED);
  assert.equal(core.verifyAudit(), true);

  const validCore = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 })
  });
  const validPlan = validCore.plan({ id: 'action-report-valid', description: 'Find a graph path' });
  assert.equal(validCore.execute({ plan: validPlan, input: graphInput() }).evidence, EVIDENCE_LEVELS.PROVEN);
});

test('constitutional execution rejects same-harness action reports replayed from a different plan', () => {
  const input = {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
  const harness = new FluidHarness();
  const donorPlan = harness.plan({ id: 'same-task-donor', description: 'Find a graph path' });
  const donorReport = harness.execute({ plan: donorPlan, input });
  const core = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 }),
    harness
  });
  const targetPlan = core.plan({ id: 'same-task-target', description: 'Find a graph path' });

  assert.equal(isTrustedActionReport(donorReport, harness, donorPlan), true);
  assert.equal(isTrustedActionReport(donorReport, harness, targetPlan), false);
  harness.execute = () => donorReport;

  assert.throws(
    () => core.execute({ plan: targetPlan, input }),
    /matching the current plan/
  );
  assert.equal(core.auditTrail.at(-1).event, CORE_EVENTS.ACTION_FAILED);
  assert.equal(core.verifyAudit(), true);
});

test('harness and constitutional execution reject plans from another harness', () => {
  const donor = new FluidHarness();
  const donorPlan = donor.plan({ id: 'donor-plan', description: 'Find a graph path' });
  const harness = new FluidHarness();
  const core = new ConstitutionalCore({ harness });
  const input = {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };

  assert.equal(isTrustedPlan(donorPlan, donor), true);
  assert.equal(isTrustedPlan(donorPlan, harness), false);
  assert.throws(
    () => harness.execute({ plan: donorPlan, input }),
    /trusted Plan/
  );
  assert.throws(
    () => core.execute({ plan: donorPlan, input }),
    /trusted Plan/
  );
});

test('constitutional cores reject plans created by another core', () => {
  const input = {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
  const source = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 })
  });
  const target = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 })
  });
  const plan = source.plan({ id: 'shared-harness-plan', description: 'Find a graph path' });

  assert.equal(source.ownsPlan(plan), true);
  assert.equal(target.ownsPlan(plan), false);
  assert.throws(
    () => target.execute({ plan, input }),
    /trusted Plan owned by this core/
  );

  const report = source.execute({ plan, input });
  assert.equal(report.taskId, plan.task.id);
  assert.equal(source.verifyAudit(), true);
  assert.equal(target.verifyAudit(), true);
});

test('constitutional cores reject reuse of a harness with mutable learning state', () => {
  const harness = new FluidHarness();
  const first = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 }),
    harness
  });

  assert.throws(
    () => new ConstitutionalCore({
      constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 }),
      harness
    }),
    /fresh harness/
  );

  const fresh = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 })
  });
  assert.notEqual(first, fresh);
  assert.equal(first.learningHistory.length, 0);
  assert.equal(fresh.learningHistory.length, 0);
});

test('evidence can move upward but not backward', () => {
  assert.equal(promoteEvidence(EVIDENCE_LEVELS.BELIEVED, EVIDENCE_LEVELS.OBSERVED), EVIDENCE_LEVELS.OBSERVED);
  assert.equal(promoteEvidence(EVIDENCE_LEVELS.OBSERVED, EVIDENCE_LEVELS.PROVEN), EVIDENCE_LEVELS.PROVEN);
  assert.throws(
    () => promoteEvidence(EVIDENCE_LEVELS.PROVEN, EVIDENCE_LEVELS.BELIEVED),
    /cannot move backwards/
  );
  assert.throws(
    () => promoteEvidence('UNKNOWN', EVIDENCE_LEVELS.OBSERVED),
    /Unknown evidence level/
  );
});

test('executes and independently verifies a shortest graph path', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({ id: 'action-1', description: 'Schedule jobs under resource constraints' });
  const graphPlan = harness.plan({
    id: 'graph-action-1',
    description: 'Find the shortest path through a dependency graph'
  });
  const report = harness.execute({
    plan: graphPlan,
    input: {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']],
      start: 'A',
      goal: 'D'
    },
    reproduction: 'node --test'
  });

  assert.equal(plan.strategy.representation, REPRESENTATIONS.CONSTRAINT_SYSTEM);
  assert.equal(report.strategy.representation, REPRESENTATIONS.GRAPH);
  assert.deepEqual(report.result.path, ['A', 'B', 'D']);
  assert.equal(report.result.distance, 2);
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.verification.verifierId, 'graph-path-verifier/v1');
  assert.match(report.environmentHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(report.invariantsChecked.length, 8);
  assert.equal(harness.worldModel.history.length, 1);
});

test('execution rejects a trusted verification replayed from another execution', () => {
  const graphInput = () => ({
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  });
  const donor = new FluidHarness();
  const donorPlan = donor.plan({ id: 'verification-donor', description: 'Find a graph path' });
  const donorReport = donor.execute({ plan: donorPlan, input: graphInput() });
  const replaying = new FluidHarness({
    verifierRegistry: new VerifierRegistry({
      verifiers: [{
        representation: REPRESENTATIONS.GRAPH,
        verify: () => donorReport.verification
      }]
    })
  });
  const replayPlan = replaying.plan({ id: 'verification-replay', description: 'Find a graph path' });

  assert.throws(
    () => replaying.execute({ plan: replayPlan, input: graphInput() }),
    /current execution/
  );
  assert.equal(replaying.lastFailureLearningError, null);

  const valid = new FluidHarness();
  const validPlan = valid.plan({ id: 'verification-valid', description: 'Find a graph path' });
  assert.equal(valid.execute({ plan: validPlan, input: graphInput() }).evidence, EVIDENCE_LEVELS.PROVEN);
});

test('execution rejects a trusted execution replayed from another registry', () => {
  const graphInput = () => ({
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  });
  const donor = new FluidHarness();
  const donorPlan = donor.plan({ id: 'execution-donor', description: 'Find a graph path' });
  const donorExecution = donor.executorRegistry.execute({
    task: donorPlan.task,
    strategy: donorPlan.strategy,
    input: graphInput()
  });
  assert.equal(isTrustedExecution(donorExecution, donor.executorRegistry), true);

  const replaying = new FluidHarness({
    executorRegistry: new ExecutorRegistry({
      executors: [{
        canExecute: () => true,
        execute: () => donorExecution
      }]
    })
  });
  const replayPlan = replaying.plan({ id: 'execution-replay', description: 'Find a graph path' });

  assert.throws(
    () => replaying.execute({ plan: replayPlan, input: graphInput() }),
    /foreign execution/
  );
  assert.equal(isTrustedExecution(donorExecution, replaying.executorRegistry), false);
  assert.equal(replaying.lastFailureLearningError, null);

  const valid = new FluidHarness();
  const validPlan = valid.plan({ id: 'execution-valid', description: 'Find a graph path' });
  assert.equal(valid.execute({ plan: validPlan, input: graphInput() }).evidence, EVIDENCE_LEVELS.PROVEN);
});

test('execution rejects reuse of an already-registered trusted execution', () => {
  const graphInput = () => ({
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  });
  class CachingGraphPathExecutor extends GraphPathExecutor {
    cachedExecution = null;

    execute(args) {
      this.cachedExecution ??= super.execute(args);
      return this.cachedExecution;
    }
  }
  const harness = new FluidHarness({
    executorRegistry: new ExecutorRegistry({
      executors: [new CachingGraphPathExecutor()]
    })
  });
  const firstPlan = harness.plan({ id: 'execution-reuse-first', description: 'Find a graph path' });
  assert.equal(harness.execute({ plan: firstPlan, input: graphInput() }).evidence, EVIDENCE_LEVELS.PROVEN);

  assert.throws(
    () => harness.execute({ plan: firstPlan, input: graphInput() }),
    /already registered/
  );
  assert.equal(harness.lastFailureLearningError, null);
});

test('harness execution rejects replay through a registry override', () => {
  const input = {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
  const cachedExecutions = new WeakMap();
  class CachingRegistry extends ExecutorRegistry {
    execute(argumentsObject) {
      let execution = cachedExecutions.get(this);
      if (execution === undefined) {
        execution = super.execute(argumentsObject);
        cachedExecutions.set(this, execution);
      }
      return execution;
    }
  }

  const harness = new FluidHarness({
    executorRegistry: new CachingRegistry({ executors: [new GraphPathExecutor()] })
  });
  const firstPlan = harness.plan({ id: 'harness-execution-replay-first', description: 'Find a graph path' });
  assert.equal(harness.execute({ plan: firstPlan, input }).evidence, EVIDENCE_LEVELS.PROVEN);

  const secondPlan = harness.plan({ id: 'harness-execution-replay-second', description: 'Find a graph path' });
  assert.throws(
    () => harness.execute({ plan: secondPlan, input }),
    /already-consumed execution/
  );
  assert.equal(harness.worldModel.history.length, 2);
  assert.equal(harness.lastFailureLearningError, null);

  const otherHarness = new FluidHarness({ executorRegistry: harness.executorRegistry });
  const otherPlan = otherHarness.plan({ id: 'harness-execution-replay-other', description: 'Find a graph path' });
  assert.throws(
    () => otherHarness.execute({ plan: otherPlan, input }),
    /consumed by another harness/
  );
  assert.equal(otherHarness.lastFailureLearningError, null);
});

test('execution rejects trusted results with mismatched task identity', () => {
  const graphInput = () => ({
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  });
  class WrongTaskExecutor extends GraphPathExecutor {
    execute(args) {
      return super.execute({
        ...args,
        task: { ...args.task, id: 'foreign-task-id' }
      });
    }
  }
  const replaying = new FluidHarness({
    executorRegistry: new ExecutorRegistry({
      executors: [new WrongTaskExecutor()]
    })
  });
  const replayPlan = replaying.plan({ id: 'requested-task-id', description: 'Find a graph path' });

  assert.throws(
    () => replaying.execute({ plan: replayPlan, input: graphInput() }),
    /requested task or strategy/
  );
  assert.equal(replaying.lastFailureLearningError, null);

  const valid = new FluidHarness();
  const validPlan = valid.plan({ id: 'identity-valid', description: 'Find a graph path' });
  assert.equal(valid.execute({ plan: validPlan, input: graphInput() }).evidence, EVIDENCE_LEVELS.PROVEN);
});

test('execution rejects trusted results with mismatched input identity', () => {
  const requestedInput = () => ({
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  });
  class WrongInputExecutor extends GraphPathExecutor {
    execute(args) {
      return super.execute({
        ...args,
        input: {
          nodes: ['A', 'B', 'C'],
          edges: [['A', 'B'], ['B', 'C']],
          start: 'A',
          goal: 'C'
        }
      });
    }
  }
  const replaying = new FluidHarness({
    executorRegistry: new ExecutorRegistry({
      executors: [new WrongInputExecutor()]
    })
  });
  const replayPlan = replaying.plan({ id: 'input-replay', description: 'Find a graph path' });

  assert.throws(
    () => replaying.execute({ plan: replayPlan, input: requestedInput() }),
    /requested input/
  );
  assert.equal(replaying.lastFailureLearningError, null);

  const valid = new FluidHarness();
  const validPlan = valid.plan({ id: 'input-valid', description: 'Find a graph path' });
  assert.equal(valid.execute({ plan: validPlan, input: requestedInput() }).evidence, EVIDENCE_LEVELS.PROVEN);
});

test('proves a graph has no path while preserving the surprise signal', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'no-path-1',
    description: 'Find the shortest path through a dependency graph'
  });
  const report = harness.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [],
      start: 'A',
      goal: 'B'
    }
  });

  assert.equal(report.result.found, false);
  assert.equal(report.result.path, null);
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.surpriseBand, SURPRISE_BANDS.HIGH);
  assert.ok(report.verification.checks.every(({ passed }) => passed));
});

test('learns strategy profiles from proven, surprised, and recovered actions', () => {
  const harness = new FluidHarness();
  const task = {
    id: 'learning-test',
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

  assert.deepEqual(
    [firstPlan.strategyProfile.attempts, limitedPlan.strategyProfile.attempts, recoveredPlan.strategyProfile.attempts],
    [0, 1, 2]
  );
  assert.equal(first.priorStrategyProfile.attempts, 0);
  assert.equal(limited.priorStrategyProfile.attempts, 1);
  assert.equal(recovered.priorStrategyProfile.attempts, 2);
  assert.ok(limited.prediction.expectedLikelihood > first.prediction.expectedLikelihood);
  assert.deepEqual(
    [first.evidence, limited.evidence, recovered.evidence],
    [EVIDENCE_LEVELS.PROVEN, EVIDENCE_LEVELS.OBSERVED, EVIDENCE_LEVELS.PROVEN]
  );
  assert.deepEqual(
    [first.surpriseBand, limited.surpriseBand, recovered.surpriseBand],
    [SURPRISE_BANDS.LOW, SURPRISE_BANDS.HIGH, SURPRISE_BANDS.LOW]
  );
  assert.equal(profile.attempts, 3);
  assert.equal(profile.predictionErrors, 1);
  assert.equal(profile.provenCases, 2);
  assert.equal(profile.observedCases, 1);
  assert.equal(profile.highSurpriseCases, 1);
  assert.equal(profile.evidenceCounts[EVIDENCE_LEVELS.PROVEN], 2);
  assert.equal(profile.evidenceCounts[EVIDENCE_LEVELS.OBSERVED], 1);
  assert.equal(harness.worldModel.strategyProfiles()['graph-algorithms'].attempts, 3);
  assert.equal(Object.isFrozen(recovered.strategyProfile), true);
});

test('records failed executions as observed high-surprise learning events', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'failure-learning-test',
    description: 'Find a graph path'
  });

  assert.throws(
    () => harness.execute({
      plan,
      input: {
        nodes: ['A'],
        edges: [],
        start: 'A',
        goal: 'B'
      }
    }),
    /start and goal must reference declared nodes/
  );

  const signal = harness.worldModel.history.at(-1);
  const profile = harness.worldModel.profile(plan.strategy.reasoningEngine);
  assert.equal(signal.evidence, EVIDENCE_LEVELS.OBSERVED);
  assert.equal(signal.verified, false);
  assert.equal(signal.failure, true);
  assert.equal(signal.surpriseBand, SURPRISE_BANDS.HIGH);
  assert.match(signal.failureReason, /start and goal/);
  assert.equal(profile.failureCases, 1);
  assert.equal(profile.predictionErrors, 1);
  assert.equal(profile.observedCases, 1);
});

test('preserves the primary execution error when failure learning fails', () => {
  const executionError = new Error('primary executor failure');
  const learningError = new Error('failure learning unavailable');
  const harness = new FluidHarness({
    executorRegistry: new ExecutorRegistry({
      executors: [{
        canExecute: () => true,
        execute: () => {
          throw executionError;
        }
      }]
    })
  });
  const plan = harness.plan({
    id: 'failure-error-preservation-test',
    description: 'Find a graph path'
  });
  harness.worldModel = {
    measure: () => {
      throw learningError;
    }
  };

  let thrownError = null;
  try {
    harness.execute({ plan, input: {} });
  } catch (error) {
    thrownError = error;
  }

  assert.equal(thrownError, executionError);
  assert.equal(harness.lastFailureLearningError, learningError);
});

test('executes and verifies a resource-constrained schedule', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'schedule-1',
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
    }
  });

  assert.equal(report.strategy.representation, REPRESENTATIONS.CONSTRAINT_SYSTEM);
  assert.deepEqual(report.result.schedule.map(({ id }) => id), ['build', 'lint', 'test', 'package']);
  assert.equal(report.result.makespan, 5);
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.verification.verifierId, 'constraint-schedule-verifier/v1');
  assert.equal(report.invariantsChecked.length, 7);
  assert.ok(report.verification.checks.every(({ passed }) => passed));
});

test('executes and independently verifies an array computation', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'array-1',
    description: 'Compute an elementwise array sum'
  });
  const report = harness.execute({
    plan,
    input: {
      left: [1, 2, 3],
      right: [4, 5, 6],
      operation: 'add'
    }
  });

  assert.equal(report.strategy.representation, REPRESENTATIONS.ARRAY_COMPUTATION);
  assert.deepEqual(report.result.values, [5, 7, 9]);
  assert.equal(report.result.length, 3);
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.verification.verifierId, 'array-computation-verifier/v1');
  assert.equal(report.invariantsChecked.length, 5);
  assert.ok(report.verification.checks.every(({ passed }) => passed));
});

test('executes and independently verifies a bounded database query', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'database-query-1',
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
      limit: 1
    }
  });

  assert.equal(plan.strategy.representation, REPRESENTATIONS.DATABASE_QUERY);
  assert.deepEqual(report.result.rows, [{ id: 'c', score: 7 }]);
  assert.equal(report.result.matchedRows, 2);
  assert.equal(report.result.returnedRows, 1);
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.verification.verifierId, 'database-query-verifier/v1');
  assert.ok(report.verification.checks.every(({ passed }) => passed));
});

test('executes and independently verifies a finite propositional theorem', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'theorem-1',
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
    }
  });

  assert.equal(plan.strategy.representation, REPRESENTATIONS.THEOREM);
  assert.equal(report.result.proved, true);
  assert.equal(report.result.counterexample, null);
  assert.equal(report.result.assignmentsChecked, 4);
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.verification.verifierId, 'theorem-prover-verifier/v1');
  assert.ok(report.verification.checks.every(({ passed }) => passed));
});

test('executes and independently verifies a bounded Bayesian posterior', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'bayesian-1',
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
    }
  });

  assert.equal(plan.strategy.representation, REPRESENTATIONS.PROBABILISTIC_INFERENCE);
  assert.equal(report.result.mostLikely, 'rain');
  assert.equal(report.result.hypothesisCount, 2);
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.verification.verifierId, 'bayesian-inference-verifier/v1');
  assert.ok(report.verification.checks.every(({ passed }) => passed));
});

test('executes and independently verifies a bounded finite-state simulation', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'simulation-1',
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
    }
  });

  assert.equal(plan.strategy.representation, REPRESENTATIONS.SIMULATION);
  assert.deepEqual(report.result.trace, ['idle', 'running', 'done']);
  assert.equal(report.result.completed, true);
  assert.equal(report.result.finalState, 'done');
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.verification.verifierId, 'finite-state-simulation-verifier/v1');
  assert.ok(report.verification.checks.every(({ passed }) => passed));
});

test('executes and independently verifies a bounded finite optimization', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'optimization-1',
    description: 'Optimize a finite candidate set'
  });
  const report = harness.execute({
    plan,
    input: {
      objective: 'minimize',
      candidates: [
        { id: 'slow', value: 9 },
        { id: 'fast', value: 2 },
        { id: 'other', value: 2 }
      ]
    }
  });

  assert.equal(plan.strategy.representation, REPRESENTATIONS.OPTIMIZATION);
  assert.equal(report.result.selectedId, 'fast');
  assert.equal(report.result.selectedValue, 2);
  assert.equal(report.result.tieBreak, 'lexicographic-id');
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.verification.verifierId, 'finite-optimizer-verifier/v1');
  assert.ok(report.verification.checks.every(({ passed }) => passed));
});

test('executes and independently verifies a bounded search tree', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'search-tree-1',
    description: 'Explore a search tree of candidate branches'
  });
  const report = harness.execute({
    plan,
    input: {
      root: 'root',
      objective: 'maximize',
      nodes: [
        { id: 'root', terminal: false },
        { id: 'left', terminal: true, value: 4 },
        { id: 'right', terminal: false },
        { id: 'deep', terminal: true, value: 7 }
      ],
      edges: [
        { from: 'root', to: 'left' },
        { from: 'root', to: 'right' },
        { from: 'right', to: 'deep' }
      ]
    }
  });

  assert.equal(plan.strategy.representation, REPRESENTATIONS.SEARCH_TREE);
  assert.equal(report.result.selectedId, 'deep');
  assert.deepEqual(report.result.path, ['root', 'right', 'deep']);
  assert.equal(report.result.terminalNodesEvaluated, 2);
  assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(report.verification.verifierId, 'finite-search-tree-verifier/v1');
});

test('routes a natural-language task through a process model provider as observed', () => {
  const fixturePath = fileURLToPath(new URL('../scripts/fixtures/model-provider.mjs', import.meta.url));
  const provider = new ProcessBackedModelProvider({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'complete',
      timeoutMs: 2000
    }),
    providerId: 'unit-provider',
    modelId: 'unit-model'
  });
  const harness = new FluidHarness({
    executorRegistry: new ExecutorRegistry({
      modelProviderExecutor: new ModelProviderExecutor({ provider })
    })
  });
  const plan = harness.plan({
    id: 'model-provider-1',
    description: 'Explain the architectural tradeoff in plain language'
  });
  const report = harness.execute({
    plan,
    input: { question: 'What is the safe boundary?' }
  });

  assert.equal(plan.strategy.representation, REPRESENTATIONS.NATURAL_LANGUAGE);
  assert.equal(report.result.providerId, 'unit-provider');
  assert.equal(report.evidence, EVIDENCE_LEVELS.OBSERVED);
  assert.equal(report.verification.verifierId, 'model-response-observer/v1');
  assert.equal(report.verification.passed, false);
  assert.equal(report.verification.deterministic, false);
});

test('full cognitive cycle exposes immutable understand-to-preserve stages', () => {
  const runner = new CognitiveCycleRunner();
  const cycle = runner.run({
    task: { id: 'cycle-test', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  });

  assert.equal(isTrustedCycleReport(cycle), true);
  assert.deepEqual(Object.keys(cycle.stages), [
    'understand',
    'represent',
    'predict',
    'act',
    'learn',
    'verify',
    'question',
    'preserve'
  ]);
  assert.equal(cycle.stages.represent.representation, REPRESENTATIONS.GRAPH);
  assert.equal(cycle.stages.predict.strategyProfile.attempts, 0);
  assert.equal(cycle.stages.verify.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(cycle.stages.learn.worldModelHistoryLength, 1);
  assert.equal(cycle.stages.learn.priorStrategyProfile.attempts, 0);
  assert.equal(cycle.stages.learn.strategyProfile.attempts, 1);
  assert.equal(cycle.stages.learn.strategyProfile.provenCases, 1);
  assert.equal(cycle.stages.question.requested, false);
  assert.equal(cycle.stages.question.reason, QUESTION_REASONS.NONE);
  assert.equal(cycle.stages.question.researchRequired, false);
  assert.ok(runner.core.auditTrail.some(({ event }) => event === CORE_EVENTS.QUESTION_DECIDED));
  assert.equal(runner.core.verifyAudit(), true);
  assert.equal(cycle.stages.preserve.coreAuditValid, true);
  assert.equal(Object.isFrozen(cycle), true);
  assert.equal(Object.isFrozen(cycle.stages), true);
});

test('cycle reports reject cross-core and cross-action replay', () => {
  const source = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 4, maxAuditEntries: 32 })
  });
  const target = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 4, maxAuditEntries: 32 })
  });
  const execute = (core, id) => {
    const plan = core.plan({ id, description: 'Find a graph path' });
    const actionReport = core.execute({
      plan,
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      }
    });
    return { plan, actionReport };
  };
  const first = execute(source, 'cycle-boundary-first');
  const second = execute(source, 'cycle-boundary-second');
  const targetPair = execute(target, 'cycle-boundary-target');
  const targetQuestion = questionFor({ actionReport: targetPair.actionReport });
  target.recordQuestion({
    taskId: targetPair.actionReport.taskId,
    actionReport: targetPair.actionReport,
    question: targetQuestion
  });

  assert.throws(
    () => new CognitiveCycleReport({
      plan: first.plan,
      actionReport: first.actionReport,
      core: target
    }),
    /owned by the supplied core/
  );
  assert.throws(
    () => new CognitiveCycleReport({
      plan: first.plan,
      actionReport: second.actionReport,
      core: source
    }),
    /tasks must match/
  );
  assert.throws(
    () => new CognitiveCycleReport({
      plan: second.plan,
      actionReport: second.actionReport,
      core: source,
      questionDecision: questionFor({ actionReport: first.actionReport })
    }),
    /trusted for the action report/
  );

  const valid = new CognitiveCycleReport({
      plan: targetPair.plan,
      actionReport: targetPair.actionReport,
      core: target,
      questionDecision: targetQuestion
    });
  assert.equal(valid.taskId, targetPair.plan.task.id);
});

test('full cycle asks for research after high surprise or weak evidence', () => {
  const runner = new CognitiveCycleRunner();
  const highSurprise = runner.run({
    task: { id: 'cycle-high-surprise', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [],
      start: 'A',
      goal: 'B'
    }
  });
  const weakEvidence = runner.run({
    task: { id: 'cycle-weak-evidence', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    executionOptions: { maxExpansions: 1 }
  });

  assert.equal(highSurprise.stages.verify.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(highSurprise.stages.learn.surpriseBand, SURPRISE_BANDS.HIGH);
  assert.equal(highSurprise.stages.question.reason, QUESTION_REASONS.HIGH_SURPRISE);
  assert.equal(highSurprise.stages.question.researchRequired, true);
  assert.equal(weakEvidence.stages.verify.evidence, EVIDENCE_LEVELS.OBSERVED);
  assert.equal(weakEvidence.stages.question.reason, QUESTION_REASONS.HIGH_SURPRISE);
  assert.equal(weakEvidence.stages.question.requested, true);
  assert.equal(weakEvidence.stages.question.researchRequired, true);
});

test('records caller observations as observed, never proven', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({ id: 'unverified-1', description: 'Describe an ambiguous requirement' });
  const report = harness.record({
    plan,
    actualObservation: 'not checked',
    result: 'drafted interpretation',
    verification: { passed: true, deterministic: true }
  });

  assert.equal(report.evidence, EVIDENCE_LEVELS.OBSERVED);
  assert.equal(report.verification, null);
  assert.equal(report.environmentHash, null);
  assert.equal(report.surpriseBand, SURPRISE_BANDS.HIGH);
});

test('manual recording rejects trusted verification replay', () => {
  const harness = new FluidHarness();
  const verifiedPlan = harness.plan({
    id: 'record-verification-source',
    description: 'Find a graph path'
  });
  const verified = harness.execute({
    plan: verifiedPlan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  });
  const manualPlan = harness.plan({
    id: 'record-verification-replay',
    description: 'Describe an ambiguous requirement'
  });

  assert.throws(
    () => harness.record({
      plan: manualPlan,
      actualObservation: 'not checked',
      result: 'claimed success',
      verification: verified.verification
    }),
    /manual record cannot accept a trusted verification/
  );
  const observed = harness.record({
    plan: manualPlan,
    actualObservation: 'not checked',
    result: 'caller observation'
  });
  assert.equal(observed.evidence, EVIDENCE_LEVELS.OBSERVED);
  assert.equal(observed.verification, null);
});

test('evaluation case inputs are immutable snapshots', () => {
  const input = {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
  const evaluationCase = new EvaluationCase({
    id: 'evaluation-case-immutability',
    domain: 'graph',
    task: { id: 'evaluation-case-immutability-task', description: 'Find a graph path' },
    input,
    expected: (report) => report.result.path.join('>') === 'A>B'
  });

  input.nodes.push('C');
  input.edges[0][0] = 'C';
  input.start = 'C';

  assert.deepEqual(evaluationCase.input, {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  });
  assert.equal(Object.isFrozen(evaluationCase.input), true);
  assert.equal(Object.isFrozen(evaluationCase.input.nodes), true);
  assert.equal(Object.isFrozen(evaluationCase.input.edges[0]), true);

  const report = new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId: 'evaluation-case-immutability',
    cases: [evaluationCase],
    mode: POLICY_MODES.RESEARCH,
    budget: new EvaluationBudget({ maxCases: 1 })
  });
  assert.equal(report.successRate, 1);
});

test('evaluation runners reject fake harnesses and untrusted action reports', () => {
  assert.throws(
    () => new EvaluationRunner({
      harness: {
        plan: () => ({}),
        execute: () => ({})
      }
    }),
    /requires a FluidHarness/
  );

  const harness = new FluidHarness();
  const runner = new EvaluationRunner({
    harness,
    execute: () => ({
      evidence: EVIDENCE_LEVELS.PROVEN,
      surpriseNats: 0,
      surpriseBand: SURPRISE_BANDS.LOW,
      strategy: { representation: REPRESENTATIONS.GRAPH },
      result: { forged: true },
      verification: { verifierId: 'forged-verifier' }
    })
  });
  const report = runner.evaluate({
    candidateId: 'untrusted-evaluation',
    mode: POLICY_MODES.RESEARCH,
    budget: new EvaluationBudget({ maxCases: 1 }),
    cases: [new EvaluationCase({
      id: 'untrusted-evaluation-case',
      domain: 'boundary',
      task: { id: 'untrusted-evaluation-task', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (actionReport) => actionReport?.result?.forged === true
    })]
  });

  assert.equal(report.provenRate, 0);
  assert.equal(report.successRate, 0);
  assert.match(report.results[0].error, /action report from the current Plan/);
});

test('evaluation runners reject replay of an already-consumed trusted action report', () => {
  const input = {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
  const harness = new FluidHarness();
  const plan = harness.plan({ id: 'evaluation-report-replay', description: 'Find a graph path' });
  const actionReport = harness.execute({ plan, input });
  const evaluationCase = new EvaluationCase({
    id: 'evaluation-report-replay-case',
    domain: 'boundary',
    task: { id: 'evaluation-report-replay', description: 'Find a graph path' },
    input,
    expected: (report) => report.result.path.join('>') === 'A>B'
  });
  const options = {
    candidateId: 'evaluation-report-replay',
    cases: [evaluationCase],
    mode: POLICY_MODES.RESEARCH,
    budget: new EvaluationBudget({ maxCases: 1 })
  };
  const runner = new EvaluationRunner({
    harness,
    plan: () => plan,
    execute: () => actionReport
  });

  assert.equal(runner.evaluate(options).successRate, 1);
  const replay = runner.evaluate(options);
  assert.equal(replay.successRate, 0);
  assert.match(replay.results[0].error, /already-consumed action report/);

  const crossRunnerReplay = new EvaluationRunner({
    harness,
    plan: () => plan,
    execute: () => actionReport
  }).evaluate(options);
  assert.equal(crossRunnerReplay.successRate, 0);
  assert.match(crossRunnerReplay.results[0].error, /consumed by another evaluation runner/);
});

test('evaluation and constitutional execution reject trusted action reports from a different input', () => {
  const donorInput = {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
  const targetInput = {
    nodes: ['A', 'B', 'C'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
  const harness = new FluidHarness();
  const core = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 }),
    harness
  });
  const donorPlan = core.plan({ id: 'input-replay-plan', description: 'Find a graph path' });
  const donorReport = harness.execute({ plan: donorPlan, input: donorInput });

  assert.equal(isTrustedActionReport(donorReport, harness, donorPlan, donorInput), true);
  assert.equal(isTrustedActionReport(donorReport, harness, donorPlan, targetInput), false);

  harness.execute = () => donorReport;
  assert.throws(
    () => core.execute({ plan: donorPlan, input: targetInput }),
    /matching the current plan/
  );

  const evaluationHarness = new FluidHarness();
  const evaluationRunner = new EvaluationRunner({
    harness: evaluationHarness,
    execute: ({ plan }) => evaluationHarness.execute({ plan, input: donorInput })
  });
  const evaluation = evaluationRunner.evaluate({
    candidateId: 'input-replay-evaluation',
    mode: POLICY_MODES.RESEARCH,
    budget: new EvaluationBudget({ maxCases: 1 }),
    cases: [new EvaluationCase({
      id: 'input-replay-case',
      domain: 'boundary',
      task: { id: 'input-replay-task', description: 'Find a graph path' },
      input: targetInput,
      expected: (report) => report?.result?.path?.join('>') === 'A>B'
    })]
  });
  assert.equal(evaluation.provenRate, 0);
  assert.match(evaluation.results[0].error, /action report from the current Plan/);
});

test('constitutional cores reject reuse of an already-consumed action report', () => {
  const input = {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
  const harness = new FluidHarness();
  const core = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 3, maxAuditEntries: 32 }),
    harness
  });
  const plan = core.plan({ id: 'action-report-reuse', description: 'Find a graph path' });
  const first = core.execute({ plan, input });
  assert.equal(core.ownsActionReport(first, plan), true);

  harness.execute = () => first;
  assert.throws(
    () => core.execute({ plan, input }),
    /already-consumed action report/
  );

  assert.equal(core.verifyAudit(), true);
});

test('separates production and research evaluation before promotion', () => {
  const cases = [
    new EvaluationCase({
      id: 'evaluation-graph',
      domain: 'graph',
      task: { id: 'eval-graph', description: 'Find the shortest path through a dependency graph' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.path.join('>') === 'A>B'
    }),
    new EvaluationCase({
      id: 'evaluation-no-path',
      domain: 'graph',
      productionEligible: false,
      task: { id: 'eval-no-path', description: 'Find the shortest path through a dependency graph' },
      input: {
        nodes: ['A', 'B'],
        edges: [],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.found === false
    }),
    new EvaluationCase({
      id: 'evaluation-invalid-input',
      domain: 'robustness',
      productionEligible: false,
      adversarial: true,
      requiresProof: false,
      task: { id: 'eval-invalid', description: 'Find the shortest path through a dependency graph' },
      input: {
        nodes: ['A', 'A'],
        edges: [],
        start: 'A',
        goal: 'A'
      },
      expected: (_report, error) => error?.message.includes('unique')
    })
  ];
  const authority = new PromotionAuthority();
  const production = new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    cases,
    mode: POLICY_MODES.PRODUCTION,
    budget: new EvaluationBudget({ maxCases: 1 })
  });
  const research = new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    cases,
    mode: POLICY_MODES.RESEARCH,
    budget: new EvaluationBudget({ maxCases: 3 })
  });
  const skeptic = new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    cases,
    mode: POLICY_MODES.SKEPTIC,
    budget: new EvaluationBudget({ maxCases: 1 })
  });

  assert.equal(production.attemptedCases, 1);
  assert.equal(production.complete, true);
  assert.equal(authority.decide(production).promoted, false);
  assert.equal(research.attemptedCases, 3);
  assert.equal(research.successRate, 1);
  assert.equal(research.provenRate, 1);
  assert.equal(research.transferMatrix.graph.successRate, 1);
  assert.equal(skeptic.adversarialSuccessRate, 1);
  assert.equal(skeptic.weaknessesExposed, 0);
  assert.equal(authority.decide(research, { skepticReport: skeptic }).promoted, true);
  assert.throws(
    () => authority.decide({ mode: POLICY_MODES.RESEARCH, successRate: 1, provenRate: 1, complete: true }),
    /EvaluationRunner/
  );
});

test('skeptic reports exposed weaknesses and blocks promotion', () => {
  const cases = [
    new EvaluationCase({
      id: 'safe-research-case',
      domain: 'graph',
      task: { id: 'safe-research-task', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.path.join('>') === 'A>B'
    }),
    new EvaluationCase({
      id: 'exposed-weakness-case',
      domain: 'robustness',
      productionEligible: false,
      adversarial: true,
      requiresProof: false,
      task: { id: 'exposed-weakness-task', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: () => false
    })
  ];
  const runner = new EvaluationRunner({ harness: new FluidHarness() });
  const research = runner.evaluate({
    candidateId: 'weakness-candidate',
    cases,
    mode: POLICY_MODES.RESEARCH,
    budget: new EvaluationBudget({ maxCases: 1 })
  });
  const skeptic = runner.evaluate({
    candidateId: 'weakness-candidate',
    cases,
    mode: POLICY_MODES.SKEPTIC,
    budget: new EvaluationBudget({ maxCases: 1 })
  });
  const decision = new PromotionAuthority().decide(research, { skepticReport: skeptic });

  assert.equal(skeptic.successRate, 0);
  assert.equal(skeptic.weaknessesExposed, 1);
  assert.equal(decision.promoted, false);
  assert.ok(decision.reasons.some((reason) => reason.includes('weakness')));
});

test('promotion rejects a skeptic report for a different candidate', () => {
  const evaluationCase = new EvaluationCase({
    id: 'candidate-mismatch-case',
    domain: 'graph',
    adversarial: true,
    task: { id: 'candidate-mismatch-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report.result.path.join('>') === 'A>B'
  });
  const evaluate = (candidateId, mode) => new EvaluationRunner({
    harness: new FluidHarness()
  }).evaluate({
    candidateId,
    cases: [evaluationCase],
    mode,
    budget: new EvaluationBudget({ maxCases: 1 })
  });
  const authority = new PromotionAuthority();
  const primary = evaluate('candidate-a', POLICY_MODES.RESEARCH);
  const mismatchedSkeptic = evaluate('candidate-b', POLICY_MODES.SKEPTIC);
  const rejected = authority.decide(primary, { skepticReport: mismatchedSkeptic });

  assert.equal(rejected.promoted, false);
  assert.ok(rejected.reasons.includes('skeptic evaluation candidate must match the primary candidate'));

  const matchingSkeptic = evaluate('candidate-a', POLICY_MODES.SKEPTIC);
  assert.equal(authority.decide(primary, { skepticReport: matchingSkeptic }).promoted, true);
});

test('promotion rejects a skeptic report from a different evaluation suite', () => {
  const graphCase = (id) => new EvaluationCase({
    id,
    domain: 'graph',
    adversarial: true,
    task: { id: `${id}-task`, description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report.result.path.join('>') === 'A>B'
  });
  const primaryCase = graphCase('primary-suite-case');
  const alternateCase = graphCase('alternate-suite-case');
  const evaluate = (cases, mode) => new EvaluationRunner({
    harness: new FluidHarness()
  }).evaluate({
    candidateId: 'same-candidate',
    cases,
    mode,
    budget: new EvaluationBudget({ maxCases: cases.length })
  });
  const authority = new PromotionAuthority();
  const primary = evaluate([primaryCase], POLICY_MODES.RESEARCH);
  const mismatchedSkeptic = evaluate([alternateCase], POLICY_MODES.SKEPTIC);
  const rejected = authority.decide(primary, { skepticReport: mismatchedSkeptic });

  assert.equal(rejected.promoted, false);
  assert.ok(rejected.reasons.includes('skeptic evaluation case suite must match the primary evaluation'));

  const matchingSkeptic = evaluate([primaryCase], POLICY_MODES.SKEPTIC);
  assert.equal(authority.decide(primary, { skepticReport: matchingSkeptic }).promoted, true);
});

test('records expectation failures without aborting the evaluation run', () => {
  const evaluationCase = new EvaluationCase({
    id: 'expectation-error',
    domain: 'robustness',
    adversarial: true,
    requiresProof: false,
    task: { id: 'expectation-error-task', description: 'Find the shortest path through a dependency graph' },
    input: {
      nodes: ['A', 'A'],
      edges: [],
      start: 'A',
      goal: 'A'
    },
    expected: () => {
      throw new Error('broken oracle');
    }
  });
  const report = new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    cases: [evaluationCase],
    mode: POLICY_MODES.SKEPTIC,
    budget: new EvaluationBudget({ maxCases: 1 })
  });

  assert.equal(report.attemptedCases, 1);
  assert.equal(report.successes, 0);
  assert.equal(report.results[0].expected, false);
});

test('measures bounded execution and keeps only non-dominated scaling points', () => {
  const evaluationCase = new EvaluationCase({
    id: 'scaling-graph',
    domain: 'scaling',
    task: {
      id: 'scaling-graph-task',
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
  });
  const curve = new ScalingRunner().evaluate({
    candidateId: 'scaling-test',
    cases: [evaluationCase],
    mode: POLICY_MODES.RESEARCH,
    levels: [
      { id: 'budget-1', computeUnits: 1, executionOptions: { maxExpansions: 1 } },
      { id: 'budget-3', computeUnits: 3, executionOptions: { maxExpansions: 3 } },
      { id: 'budget-6', computeUnits: 6, executionOptions: { maxExpansions: 6 } }
    ]
  });

  assert.equal(isTrustedScalingCurve(curve), true);
  assert.deepEqual(curve.points.map(({ successRate }) => successRate), [0, 0, 1]);
  assert.deepEqual(curve.points.map(({ provenRate }) => provenRate), [0, 0, 1]);
  assert.deepEqual(curve.frontier.map(({ levelId }) => levelId), ['budget-1', 'budget-6']);
  assert.equal(curve.complete, true);
});

test('scaling evaluation rejects a shared harness across levels', () => {
  const sharedHarness = new FluidHarness();
  const evaluationCase = new EvaluationCase({
    id: 'scaling-isolation',
    domain: 'scaling',
    task: { id: 'scaling-isolation-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report.result.path.join('>') === 'A>B'
  });

  assert.throws(
    () => new ScalingRunner({ harnessFactory: () => sharedHarness }).evaluate({
      cases: [evaluationCase],
      levels: [
        { id: 'scaling-isolation-one', computeUnits: 1 },
        { id: 'scaling-isolation-two', computeUnits: 2 }
      ]
    }),
    /fresh harness/
  );
});

test('scaling evaluation rejects shared harness dependencies across levels', () => {
  const evaluationCase = new EvaluationCase({
    id: 'scaling-dependency-isolation',
    domain: 'scaling',
    task: { id: 'scaling-dependency-isolation-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report.result.path.join('>') === 'A>B'
  });
  const budget = new EvaluationBudget({ maxCases: 1 });
  const levels = [
    { id: 'dependency-one', computeUnits: 1 },
    { id: 'dependency-two', computeUnits: 2 }
  ];
  const sharedDependencies = [
    ['selector', new HeuristicRepresentationSelector()],
    ['world model', new WorldModel()],
    ['executor registry', new ExecutorRegistry()],
    ['verifier registry', new VerifierRegistry()]
  ];

  for (const [label, shared] of sharedDependencies) {
    assert.throws(
      () => new ScalingRunner({
        harnessFactory: () => new FluidHarness({
          selector: label === 'selector' ? shared : new HeuristicRepresentationSelector(),
          worldModel: label === 'world model' ? shared : new WorldModel(),
          executorRegistry: label === 'executor registry' ? shared : new ExecutorRegistry(),
          verifierRegistry: label === 'verifier registry' ? shared : new VerifierRegistry()
        })
      }).evaluate({
        candidateId: `shared-${label}`,
        cases: [evaluationCase],
        mode: POLICY_MODES.RESEARCH,
        levels,
        productionBudget: budget
      }),
      /fresh harness dependencies/
    );
  }

  const valid = new ScalingRunner().evaluate({
    candidateId: 'fresh-dependencies',
    cases: [evaluationCase],
    mode: POLICY_MODES.RESEARCH,
    levels,
    productionBudget: budget
  });
  assert.equal(valid.points.length, 2);
});

test('scaling evaluation rejects shared executor and verifier internals across levels', () => {
  const evaluationCase = new EvaluationCase({
    id: 'scaling-registry-internals',
    domain: 'scaling',
    task: { id: 'scaling-registry-internals-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report.result.path.join('>') === 'A>B'
  });
  const levels = [
    { id: 'internals-one', computeUnits: 1 },
    { id: 'internals-two', computeUnits: 2 }
  ];
  const sharedExecutor = new GraphPathExecutor();
  assert.throws(
    () => new ScalingRunner({
      harnessFactory: () => new FluidHarness({
        executorRegistry: new ExecutorRegistry({ executors: [sharedExecutor] })
      })
    }).evaluate({ cases: [evaluationCase], mode: POLICY_MODES.RESEARCH, levels }),
    /registry internals/
  );

  const sharedVerifier = (execution, options) => verifyGraphExecution(execution, options);
  assert.throws(
    () => new ScalingRunner({
      harnessFactory: () => new FluidHarness({
        verifierRegistry: new VerifierRegistry({
          verifiers: [{ representation: REPRESENTATIONS.GRAPH, verify: sharedVerifier }]
        })
      })
    }).evaluate({ cases: [evaluationCase], mode: POLICY_MODES.RESEARCH, levels }),
    /registry internals/
  );

  const valid = new ScalingRunner().evaluate({
    cases: [evaluationCase],
    mode: POLICY_MODES.RESEARCH,
    levels
  });
  assert.equal(valid.points.length, 2);
});

test('does not promote a resource-limited graph search to proven evidence', () => {
  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'limited-graph',
    description: 'Find the shortest path through a dependency graph'
  });
  const report = harness.execute({
    plan,
    input: {
      nodes: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      start: 'A',
      goal: 'C'
    },
    executionOptions: { maxExpansions: 1 }
  });

  assert.equal(report.result.searchComplete, false);
  assert.equal(report.result.expansions, 1);
  assert.equal(report.evidence, EVIDENCE_LEVELS.OBSERVED);
  assert.equal(report.verification.checks.find(({ id }) => id === 'search-state').passed, true);
  assert.equal(report.verification.passed, false);
});

test('constitutional core enforces limits and preserves a tamper-evident audit trail', () => {
  const core = new ConstitutionalCore({
    constitution: new Constitution({
      maxActions: 2,
      maxGraphExpansions: 2,
      maxAuditEntries: 32
    })
  });
  const plan = core.plan({
    id: 'core-test-limited',
    description: 'Find the shortest path through a dependency graph'
  });
  const limited = core.execute({
    plan,
    input: {
      nodes: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      start: 'A',
      goal: 'C'
    },
    executionOptions: { maxExpansions: 1 }
  });

  assert.equal(limited.evidence, EVIDENCE_LEVELS.OBSERVED);
  assert.throws(
    () => core.execute({
      plan,
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      executionOptions: { maxExpansions: 3 }
    }),
    /exceeds constitutional limit/
  );
  core.shutdown('test shutdown');
  assert.throws(() => core.execute({ plan, input: {} }), /core is shutdown/);
  core.resume('test resume');
  const full = core.execute({
    plan: core.plan({ id: 'core-test-full', description: 'Find a graph path' }),
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  });

  assert.equal(full.evidence, EVIDENCE_LEVELS.PROVEN);
  assert.equal(core.status.actionsUsed, 2);
  assert.equal(core.verifyAudit(), true);
  assert.ok(core.auditTrail.some(({ event }) => event === CORE_EVENTS.SHUTDOWN));
  assert.ok(core.auditTrail.some(({ event }) => event === CORE_EVENTS.RESUMED));
  assert.ok(core.auditTrail.every(({ hash }) => /^sha256:[0-9a-f]{64}$/.test(hash)));
});

test('constitutional input envelope rejects oversized and cyclic data before admission', () => {
  const core = new ConstitutionalCore({
    constitution: new Constitution({
      maxActions: 2,
      maxGraphExpansions: 4,
      maxGraphNodes: 2,
      maxGraphEdges: 2,
      maxInputBytes: 512,
      maxAuditEntries: 32
    })
  });
  const plan = core.plan({ id: 'sandbox-test', description: 'Find a graph path' });
  assert.throws(
    () => core.execute({
      plan,
      input: {
        nodes: ['A', 'B', 'C'],
        edges: [['A', 'B'], ['B', 'C']],
        start: 'A',
        goal: 'C'
      }
    }),
    /Graph node count 3 exceeds constitutional limit 2/
  );
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => core.execute({ plan, input: cyclic }), /not JSON-serializable/);
  assert.equal(core.status.actionsUsed, 0);
  assert.equal(core.auditTrail.filter(({ event }) => event === CORE_EVENTS.ACTION_REJECTED).length, 2);
  assert.equal(core.verifyAudit(), true);
});

test('constitutional core routes research evaluation through its policy boundary', () => {
  const core = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 4, maxGraphExpansions: 4, maxAuditEntries: 32 })
  });
  const report = core.evaluate({
    candidateId: 'core-evaluation',
    mode: POLICY_MODES.RESEARCH,
    budget: new EvaluationBudget({ maxCases: 1 }),
    cases: [new EvaluationCase({
      id: 'core-evaluation-case',
      domain: 'graph',
      task: { id: 'core-evaluation-task', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
    })]
  });

  assert.equal(report.mode, POLICY_MODES.RESEARCH);
  assert.equal(report.successRate, 1);
  assert.equal(report.provenRate, 1);
  assert.equal(core.status.actionsUsed, 1);
  assert.equal(core.auditTrail.find(({ event }) => event === CORE_EVENTS.ACTION_ADMITTED).payload.policyMode, POLICY_MODES.RESEARCH);
  assert.equal(core.promote(report).promoted, false);
  assert.equal(core.verifyAudit(), true);
});

test('constitutional promotion rejects a primary evaluation report from another core', () => {
  const sourceCore = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 })
  });
  const targetCore = new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 })
  });
  const report = sourceCore.evaluate({
    candidateId: 'promotion-replay-test',
    mode: POLICY_MODES.RESEARCH,
    budget: new EvaluationBudget({ maxCases: 1 }),
    cases: [new EvaluationCase({
      id: 'promotion-replay-case',
      domain: 'graph',
      task: { id: 'promotion-replay-task', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
    })]
  });

  assert.throws(
    () => targetCore.promote(report),
    /produced by this core/
  );
  assert.equal(sourceCore.promote(report).promoted, false);
  assert.equal(sourceCore.verifyAudit(), true);
  assert.equal(targetCore.verifyAudit(), true);
});

test('representation search ranks transfer and skeptic performance across isolated candidates', () => {
  const cases = [
    new EvaluationCase({
      id: 'search-test-graph',
      domain: 'graph',
      task: { id: 'search-test-graph-task', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.path.join('>') === 'A>B'
    }),
    new EvaluationCase({
      id: 'search-test-constraint',
      domain: 'constraints',
      task: { id: 'search-test-constraint-task', description: 'Schedule jobs under resource constraints' },
      input: {
        resources: { cpu: 1 },
        jobs: [{ id: 'build', duration: 1, demand: { cpu: 1 } }]
      },
      expected: (report) => report.result.makespan === 1
    }),
    new EvaluationCase({
      id: 'search-test-ambiguous',
      domain: 'robustness',
      productionEligible: false,
      adversarial: true,
      requiresProof: false,
      task: { id: 'search-test-ambiguous-task', description: 'Graph database' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (_report, error) => error?.message.includes('No executor')
    })
  ];
  const report = new RepresentationSearchRunner().evaluate({
    candidates: [
      new RepresentationCandidate({
        id: 'graph-biased-test',
        selectorFactory: () => ({ select: () => REPRESENTATIONS.GRAPH })
      }),
      new RepresentationCandidate({
        id: 'heuristic-test',
        selectorFactory: () => new HeuristicRepresentationSelector()
      })
    ],
    cases,
    productionBudget: new EvaluationBudget({ maxCases: 3 }),
    researchBudget: new EvaluationBudget({ maxCases: 3 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });

  assert.equal(isTrustedSearchReport(report), true);
  assert.equal(report.winner.candidateId, 'heuristic-test');
  assert.equal(report.promoted.candidateId, 'heuristic-test');
  assert.equal(report.allAuditsValid, true);
  assert.equal(report.results[0].research.transferMatrix.graph.successRate, 1);
  assert.equal(report.results[0].fitness.skepticWeaknessesExposed, 0);
  assert.equal(report.results[1].decision.promoted, false);
  const adoptedSelector = selectorFromPromotedSearch(report);
  assert.equal(
    strategyFor(new Task({ id: 'adopted-task', description: 'Find a graph path' }), adoptedSelector).representation,
    REPRESENTATIONS.GRAPH
  );
  assert.throws(
    () => selectorFromPromotedSearch({ promoted: report.promoted }),
    /trusted search report/
  );
});

test('representation search isolates policy modes with fresh selectors and audits', () => {
  let selectorInstances = 0;
  const report = new RepresentationSearchRunner().evaluate({
    candidates: [new RepresentationCandidate({
      id: 'isolated-policy-candidate',
      selectorFactory: () => {
        selectorInstances += 1;
        return new HeuristicRepresentationSelector();
      }
    })],
    cases: [new EvaluationCase({
      id: 'isolated-policy-case',
      domain: 'graph',
      adversarial: true,
      task: { id: 'isolated-policy-task', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
    })],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });

  assert.equal(selectorInstances, 3);
  assert.equal(report.allAuditsValid, true);
  assert.equal(report.results[0].production.successRate, 1);
  assert.equal(report.results[0].research.successRate, 1);
  assert.equal(report.results[0].skeptic.successRate, 1);
});

test('representation search rejects a selector reused across policy modes', () => {
  const report = new RepresentationSearchRunner().evaluate({
    candidates: [new RepresentationCandidate({
      id: 'shared-selector-test',
      selector: new HeuristicRepresentationSelector()
    })],
    cases: [new EvaluationCase({
      id: 'shared-selector-case',
      domain: 'graph',
      task: { id: 'shared-selector-task', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
    })],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });

  assert.equal(report.promoted, null);
  assert.equal(report.results[0].research, null);
  assert.match(report.results[0].error, /fresh selector/);
});

test('representation search rejects a selector reused across candidates', () => {
  const sharedSelector = new HeuristicRepresentationSelector();
  let firstCandidateCalls = 0;
  let secondCandidateCalls = 0;
  const freshSelector = () => ({ select: () => REPRESENTATIONS.GRAPH });
  const budget = new EvaluationBudget({ maxCases: 1 });
  const report = new RepresentationSearchRunner().evaluate({
    candidates: [
      new RepresentationCandidate({
        id: 'first-selector-candidate',
        selectorFactory: () => {
          firstCandidateCalls += 1;
          return firstCandidateCalls === 1 ? sharedSelector : freshSelector();
        }
      }),
      new RepresentationCandidate({
        id: 'second-selector-candidate',
        selectorFactory: () => {
          secondCandidateCalls += 1;
          return secondCandidateCalls === 1 ? sharedSelector : freshSelector();
        }
      })
    ],
    cases: [new EvaluationCase({
      id: 'selector-candidate-boundary-case',
      domain: 'graph',
      adversarial: true,
      task: { id: 'selector-candidate-boundary-task', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
    })],
    productionBudget: budget,
    researchBudget: budget,
    skepticBudget: budget
  });

  assert.equal(report.results[0].error, null);
  assert.equal(report.results[1].production, null);
  assert.match(report.results[1].error, /fresh selector/);
});

test('representation search rejects a promotion authority reused across policy modes', () => {
  const cases = [new EvaluationCase({
    id: 'promotion-authority-isolation-case',
    domain: 'graph',
    adversarial: true,
    task: { id: 'promotion-authority-isolation-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report.result.path.join('>') === 'A>B'
  })];
  const budget = new EvaluationBudget({ maxCases: 1 });
  const sharedAuthority = new PromotionAuthority();
  const rejected = new RepresentationSearchRunner({
    promotionAuthorityFactory: () => sharedAuthority
  }).evaluate({
    candidates: [new RepresentationCandidate({
      id: 'shared-promotion-authority',
      selectorFactory: () => new HeuristicRepresentationSelector()
    })],
    cases,
    productionBudget: budget,
    researchBudget: budget,
    skepticBudget: budget
  });

  assert.equal(rejected.results[0].research, null);
  assert.match(rejected.results[0].error, /fresh promotion authority/);

  const valid = new RepresentationSearchRunner().evaluate({
    candidates: [new RepresentationCandidate({
      id: 'fresh-promotion-authority',
      selectorFactory: () => new HeuristicRepresentationSelector()
    })],
    cases,
    productionBudget: budget,
    researchBudget: budget,
    skepticBudget: budget
  });
  assert.equal(valid.results[0].error, null);
});

test('representation search rejects a selector factory reused across candidates', () => {
  const cases = [new EvaluationCase({
    id: 'selector-factory-isolation-case',
    domain: 'graph',
    adversarial: true,
    task: { id: 'selector-factory-isolation-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report.result.path.join('>') === 'A>B'
  })];
  const budget = new EvaluationBudget({ maxCases: 1 });
  const sharedFactory = () => new HeuristicRepresentationSelector();
  const rejected = new RepresentationSearchRunner().evaluate({
    candidates: [
      new RepresentationCandidate({ id: 'first-shared-factory', selectorFactory: sharedFactory }),
      new RepresentationCandidate({ id: 'second-shared-factory', selectorFactory: sharedFactory })
    ],
    cases,
    productionBudget: budget,
    researchBudget: budget,
    skepticBudget: budget
  });

  assert.equal(rejected.results[0].error, null);
  assert.equal(rejected.results[1].production, null);
  assert.match(rejected.results[1].error, /fresh selector factory/);

  const valid = new RepresentationSearchRunner().evaluate({
    candidates: [
      new RepresentationCandidate({
        id: 'first-fresh-factory',
        selectorFactory: () => new HeuristicRepresentationSelector()
      }),
      new RepresentationCandidate({
        id: 'second-fresh-factory',
        selectorFactory: () => new HeuristicRepresentationSelector()
      })
    ],
    cases,
    productionBudget: budget,
    researchBudget: budget,
    skepticBudget: budget
  });
  assert.equal(valid.results.every(({ error }) => error === null), true);
});

test('promoted selector adoption rejects selectors already used during search', () => {
  const created = [];
  const candidate = new RepresentationCandidate({
    id: 'adoption-selector-replay',
    selectorFactory: () => {
      if (created.length < 3) {
        const selector = new HeuristicRepresentationSelector();
        created.push(selector);
        return selector;
      }
      return created[0];
    }
  });
  const report = new RepresentationSearchRunner().evaluate({
    candidates: [candidate],
    cases: [new EvaluationCase({
      id: 'adoption-selector-replay-case',
      domain: 'graph',
      adversarial: true,
      task: { id: 'adoption-selector-replay-task', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
    })],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });

  assert.equal(report.promoted.candidateId, candidate.id);
  assert.throws(
    () => selectorFromPromotedSearch(report),
    /fresh selector not used during search or prior adoption/
  );

  const freshSelectors = [];
  const validReport = new RepresentationSearchRunner().evaluate({
    candidates: [new RepresentationCandidate({
      id: 'fresh-adoption-selector',
      selectorFactory: () => {
        const selector = new HeuristicRepresentationSelector();
        freshSelectors.push(selector);
        return selector;
      }
    })],
    cases: [new EvaluationCase({
      id: 'fresh-adoption-selector-case',
      domain: 'graph',
      adversarial: true,
      task: { id: 'fresh-adoption-selector-task', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
    })],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
  const evaluatedSelectors = [...freshSelectors];
  const adopted = selectorFromPromotedSearch(validReport);
  assert.equal(evaluatedSelectors.includes(adopted), false);
});

test('mutation authority unlocks only the next level after trusted improvement', () => {
  const cases = [
      new EvaluationCase({
        id: 'mutation-graph',
        domain: 'graph',
        task: { id: 'mutation-graph-task', description: 'Find a graph path' },
        input: {
          nodes: ['A', 'B'],
          edges: [['A', 'B']],
          start: 'A',
          goal: 'B'
        },
        expected: (report) => report.result.path.join('>') === 'A>B'
      }),
      new EvaluationCase({
        id: 'mutation-ambiguous',
        domain: 'robustness',
        productionEligible: false,
        adversarial: true,
        requiresProof: false,
        task: { id: 'mutation-ambiguous-task', description: 'Graph database' },
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
      id: 'graph-mutation-test',
      selectorFactory: () => ({ select: () => REPRESENTATIONS.GRAPH })
    }),
    new RepresentationCandidate({
      id: 'heuristic-mutation-test',
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
  const authority = new EvolutionAuthority();
  const selfAttested = authority.propose({
    id: 'self-attested-mutation-test',
    level: MUTATION_LEVELS.PROMPTS,
    searchReport,
    baselineCandidateId: 'graph-mutation-test',
    candidateCandidateId: 'heuristic-mutation-test',
    reproducible: true
  });
  assert.equal(authority.approve(selfAttested).approved, false);
  assert.ok(authority.approve(selfAttested).reasons.includes('reproducible evidence is required'));
  const skipped = authority.approve(authority.propose({
    id: 'skip-mutation-test',
    level: MUTATION_LEVELS.MODULES,
    searchReport,
    baselineCandidateId: 'graph-mutation-test',
    candidateCandidateId: 'heuristic-mutation-test',
    reproductionReport
  }));
  assert.equal(skipped.approved, false);
  const approvedProposal = authority.propose({
    id: 'prompt-mutation-test',
    level: MUTATION_LEVELS.PROMPTS,
    searchReport,
    baselineCandidateId: 'graph-mutation-test',
    candidateCandidateId: 'heuristic-mutation-test',
    reproductionReport
  });
  const approved = authority.approve(approvedProposal);

  assert.equal(approved.approved, true);
  const otherAuthority = new EvolutionAuthority();
  assert.equal(isTrustedMutationProposal(approvedProposal, authority), true);
  assert.equal(isTrustedMutationProposal(approvedProposal, otherAuthority), false);
  assert.throws(
    () => otherAuthority.approve(approvedProposal),
    /issued by EvolutionAuthority/
  );
  assert.equal(isTrustedMutationPermit(approved.permit, authority), true);
  assert.equal(isTrustedMutationPermit(approved.permit, otherAuthority), false);
  assert.equal(authority.unlockedThrough, MUTATION_LEVELS.PROMPTS);
  assert.equal(authority.canAttempt(MUTATION_LEVELS.PROMPTS), true);
  assert.equal(authority.canAttempt(MUTATION_LEVELS.POLICIES), false);
  assert.equal(authority.history.length, 1);
});

test('rejects malformed task and graph input at the boundary', () => {
  assert.throws(
    () => new Task({ id: 'bad-description', description: 42 }),
    /description must be a non-empty string/
  );

  const harness = new FluidHarness();
  const plan = harness.plan({ id: 'bad-graph', description: 'Find a graph path' });
  assert.throws(
    () => harness.execute({ plan, input: { nodes: ['A'], edges: [], start: 'A', goal: 'B' } }),
    /start and goal must reference declared nodes/
  );
  assert.throws(
    () => harness.execute({
      plan,
      input: { nodes: ['A', 'B'], edges: [['A', 'B']], start: 'A', goal: 'B' },
      executionOptions: { maxExpansions: 0 }
    }),
    /maxExpansions must be a positive integer/
  );

  const constraintPlan = harness.plan({
    id: 'bad-constraint',
    description: 'Schedule jobs under resource constraints'
  });
  assert.throws(
    () => harness.execute({
      plan: constraintPlan,
      input: {
        resources: { cpu: 1 },
        jobs: [
          { id: 'a', duration: 1, demand: { cpu: 1 }, prerequisites: ['b'] },
          { id: 'b', duration: 1, demand: { cpu: 1 }, prerequisites: ['a'] }
        ]
      }
    }),
    /dependency cycles/
  );

  const arrayPlan = harness.plan({
    id: 'bad-array',
    description: 'Compute an array sum'
  });
  assert.throws(
    () => harness.execute({
      plan: arrayPlan,
      input: { left: [1], right: [2, 3], operation: 'add' }
    }),
    /equal length/
  );
});
