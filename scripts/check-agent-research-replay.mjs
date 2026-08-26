import assert from 'node:assert/strict';

import {
  AGENT_RESEARCH_STATUSES,
  BoundedAgentRunner,
  isTrustedAgentResearchResolutionReport,
  isTrustedAgentRunReport
} from '../src/agent.mjs';
import { continueBoundedAgentFromLedger } from '../src/agent-continuation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { EvaluationBudget, EvaluationCase } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import { RepresentationCandidate } from '../src/search.mjs';
import { isTrustedActionReport } from '../src/harness.mjs';

function successEpisode(id) {
  return {
    task: { id, description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  };
}

function surprisingEpisode(id) {
  return {
    task: { id, description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [],
      start: 'A',
      goal: 'B'
    }
  };
}

function researchSpec(prefix) {
  return {
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
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

const sourceRunner = new BoundedAgentRunner();
const sourceReport = sourceRunner.run({
  episodes: [successEpisode('research-replay-before'), surprisingEpisode('research-replay-pending')]
});
assert.equal(sourceReport.pendingResearch.length, 1);
const ledger = new EvidenceLedger();
ledger.appendAgentRun(sourceReport);
ledger.appendCore(sourceRunner.cycleRunner.core);

const continuation = continueBoundedAgentFromLedger({ ledger });
assert.equal(continuation.context.pendingResearch.length, 1);
const archivedAction = continuation.context.priorRuns[0].cycles[1].action;
assert.equal(isTrustedActionReport(archivedAction), false);

const replay = continuation.replayResearchHandoff({
  reproduction: 'check-agent-research-replay'
});
assert.equal(isTrustedAgentRunReport(replay), true);
assert.equal(replay.completed, false);
assert.equal(replay.stopReason, 'RESEARCH_REQUIRED');
assert.equal(replay.pendingResearch.length, 1);
assert.equal(replay.cycles.length, 1);
assert.equal(replay.cycles[0].action.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(isTrustedActionReport(replay.cycles[0].action), true);
assert.notEqual(replay.cycles[0].action, archivedAction);
assert.equal(replay.cycles[0].action.taskId, 'research-replay-pending');
assert.equal(replay.cycles[0].action.priorStrategyProfile.attempts, 2);

const resolved = continuation.runner.resolveResearch({
  runReport: replay,
  research: researchSpec('research-replay-complete')
});
assert.equal(isTrustedAgentResearchResolutionReport(resolved), true);
assert.equal(resolved.status, AGENT_RESEARCH_STATUSES.RESOLVED);
assert.equal(resolved.pendingResearch.length, 0);
assert.equal(resolved.auditValid, true);
assert.equal(continuation.context.pendingResearch.length, 1);

console.log(
  `FLUID_AGENT_RESEARCH_REPLAY_OK archivedTrusted=${isTrustedActionReport(archivedAction)} `
  + `replayTrusted=${isTrustedActionReport(replay.cycles[0].action)} `
  + `replayAction=${replay.cycles[0].actionNumber} resolved=${resolved.status} `
  + `freshAudit=${resolved.auditValid}`
);
