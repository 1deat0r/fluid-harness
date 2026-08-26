import assert from 'node:assert/strict';

import { BoundedAgentRunner } from '../src/agent.mjs';
import {
  continueBoundedAgentFromLedger,
  isTrustedAgentContinuation
} from '../src/agent-continuation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';

function episode(id, edges = [['A', 'B']]) {
  return {
    task: { id, description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges,
      start: 'A',
      goal: 'B'
    }
  };
}

const completedRunner = new BoundedAgentRunner();
const completedReport = completedRunner.run({ episodes: [episode('research-replay-no-pending')] });
const completedLedger = new EvidenceLedger();
completedLedger.appendAgentRun(completedReport);
completedLedger.appendCore(completedRunner.cycleRunner.core);
const noPending = continueBoundedAgentFromLedger({ ledger: completedLedger });
assert.throws(
  () => noPending.replayResearchHandoff(),
  /no pending research handoff/
);

const pendingRunner = new BoundedAgentRunner();
const pendingReport = pendingRunner.run({ episodes: [episode('research-replay-other', [])] });
const pendingLedger = new EvidenceLedger();
pendingLedger.appendAgentRun(pendingReport);
pendingLedger.appendCore(pendingRunner.cycleRunner.core);
const continuation = continueBoundedAgentFromLedger({ ledger: pendingLedger });
assert.throws(
  () => continuation.replayResearchHandoff({ taskId: 'not-the-pending-task' }),
  /no pending research handoff for task/
);

const spoofed = Object.create(Object.getPrototypeOf(continuation));
assert.equal(isTrustedAgentContinuation(spoofed), false);
assert.throws(
  () => continuation.replayResearchHandoff.call(spoofed),
  /exact trusted continuation/
);

const tampered = JSON.parse(pendingLedger.serialize());
tampered.records[0].payload.cycles[0].taskId = 'tampered-task';
assert.throws(
  () => continueBoundedAgentFromLedger({
    ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered))
  }),
  /hash verification failed/
);

console.log(
  `FLUID_AGENT_RESEARCH_REPLAY_REJECTION_OK noPending=true mismatchRejected=true `
  + `spoofed=${isTrustedAgentContinuation(spoofed)} tamperRejected=true`
);
