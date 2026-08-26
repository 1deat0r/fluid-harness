import {
  BoundedAgentRunner,
  isTrustedAgentRunner
} from './agent.mjs';
import {
  CognitiveCycleRunner
} from './cycle.mjs';
import {
  Constitution,
  ConstitutionalCore,
  isTrustedConstitution
} from './constitution.mjs';
import {
  EvidenceLedger,
  isTrustedEvidenceLedger
} from './evidence-ledger.mjs';
import {
  AgentPolicy,
  isTrustedAgentPolicy
} from './evolution.mjs';
import { FluidHarness } from './harness.mjs';
import {
  arrayFind,
  arraySlice,
  isPlainObject,
  objectFreeze,
  objectGetPrototypeOf,
  objectHasOwn,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_AGENT_CONTINUATIONS = weakSetCreate();

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function policySnapshot(policy) {
  return objectFreeze({
    dataOnly: true,
    maxEpisodes: policy.maxEpisodes,
    maxToolCallsPerEpisode: policy.maxToolCallsPerEpisode
  });
}

function latestPolicySnapshot(runs) {
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    if (runs[index].policy !== null) {
      return runs[index].policy;
    }
  }
  return null;
}

function continuationContext({ runs, pendingResearch, worldModel, policy }) {
  const priorPolicy = latestPolicySnapshot(runs);
  return objectFreeze({
    dataOnly: true,
    source: 'EVIDENCE_LEDGER',
    priorRuns: objectFreeze(arraySlice(runs)),
    pendingResearch: objectFreeze(arraySlice(pendingResearch)),
    priorPolicy: priorPolicy === null ? null : objectFreeze({ ...priorPolicy }),
    effectivePolicy: policySnapshot(policy),
    priorWorldModelHistoryLength: worldModel.history.length
  });
}

function replayTaskFromContext(context, taskId) {
  const pending = taskId === null
    ? context.pendingResearch[0]
    : arrayFind(context.pendingResearch, (entry) => entry.taskId === taskId);
  if (!pending) {
    throw new Error(
      taskId === null
        ? 'Agent continuation has no pending research handoff'
        : `Agent continuation has no pending research handoff for task: ${taskId}`
    );
  }

  for (let runIndex = 0; runIndex < context.priorRuns.length; runIndex += 1) {
    const run = context.priorRuns[runIndex];
    const cycle = arrayFind(
      run.cycles,
      (candidate) => candidate.actionNumber === pending.actionNumber
        && candidate.taskId === pending.taskId
        && candidate.questionDecision?.researchRequired === true
    );
    if (!cycle) {
      continue;
    }
    const description = cycle.stages?.understand?.description;
    if (typeof description !== 'string' || stringTrim(description) === '') {
      throw new Error('Agent continuation research handoff has no replayable task description');
    }
    if (!cycle.action || !objectHasOwn(cycle.action, 'input')) {
      throw new Error('Agent continuation research handoff has no replayable action input');
    }
    return {
      task: {
        id: requireNonEmptyString(cycle.taskId, 'Agent continuation replay task id'),
        description: stringTrim(description)
      },
      input: cycle.action.input
    };
  }
  throw new Error('Agent continuation research handoff has no matching archived cycle');
}

export class AgentContinuation {
  constructor({ runner, context } = {}) {
    if (!isTrustedAgentRunner(runner)) {
      throw new TypeError('AgentContinuation requires a trusted BoundedAgentRunner');
    }
    if (!isPlainObject(context) || context.dataOnly !== true) {
      throw new TypeError('AgentContinuation requires a data-only context');
    }
    this.runner = runner;
    this.context = context;
    weakSetAdd(TRUSTED_AGENT_CONTINUATIONS, this);
    objectFreeze(this);
  }

  run(options) {
    return this.runner.run(options);
  }

  replayResearchHandoff({ taskId = null, reproduction = 'AgentContinuation.replayResearchHandoff' } = {}) {
    if (!isTrustedAgentContinuation(this)) {
      throw new TypeError('Agent continuation research replay requires an exact trusted continuation');
    }
    const normalizedTaskId = taskId === null
      ? null
      : requireNonEmptyString(taskId, 'Agent continuation research taskId');
    const replay = replayTaskFromContext(this.context, normalizedTaskId);
    return this.runner.run({
      episodes: [{
        task: replay.task,
        input: replay.input
      }],
      stopOnResearchRequired: true,
      reproduction: requireNonEmptyString(reproduction, 'Agent continuation replay reproduction')
    });
  }
}

export function isTrustedAgentContinuation(continuation) {
  return typeof continuation === 'object'
    && continuation !== null
    && weakSetHas(TRUSTED_AGENT_CONTINUATIONS, continuation)
    && objectGetPrototypeOf(continuation) === AgentContinuation.prototype;
}

export function continueBoundedAgentFromLedger({
  ledger,
  toolRegistry = null,
  policy = null,
  constitution = new Constitution()
} = {}) {
  if (!isTrustedEvidenceLedger(ledger)) {
    throw new TypeError('Agent continuation requires a trusted EvidenceLedger');
  }
  if (!isTrustedConstitution(constitution)) {
    throw new TypeError('Agent continuation requires a trusted Constitution');
  }
  if (policy !== null && !isTrustedAgentPolicy(policy)) {
    throw new TypeError('Agent continuation explicit policy must be trusted');
  }

  const restoredRuns = ledger.restoreAgentRuns();
  const pendingResearch = ledger.restoreResearchQueue();
  const worldModel = ledger.restoreWorldModel({
    highSurpriseThreshold: constitution.maxSurpriseThreshold
  });
  const restoredPolicy = latestPolicySnapshot(restoredRuns);
  const effectivePolicy = policy ?? (
    restoredPolicy === null
      ? new AgentPolicy()
      : new AgentPolicy({
        maxEpisodes: restoredPolicy.maxEpisodes,
        maxToolCallsPerEpisode: restoredPolicy.maxToolCallsPerEpisode
      })
  );
  const harness = new FluidHarness({ worldModel });
  const core = new ConstitutionalCore({ constitution, harness });
  const cycleRunner = new CognitiveCycleRunner({ core });
  const runner = new BoundedAgentRunner({
    cycleRunner,
    toolRegistry,
    policy: effectivePolicy
  });
  const context = continuationContext({
    runs: restoredRuns,
    pendingResearch,
    worldModel,
    policy: effectivePolicy
  });
  return new AgentContinuation({ runner, context });
}

objectFreeze(AgentContinuation.prototype);
