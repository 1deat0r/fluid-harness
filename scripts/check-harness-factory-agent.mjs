import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-agent',
  includeResearch: true
});
const {
  factory,
  ledger,
  researchContext,
  plannerCandidate,
  evaluationCase,
  budgets
} = fixture;

const report = factory.manufacture({
  goal: 'manufacture and smoke-test a bounded graph agent',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets,
  researchContext,
  agentGoal: 'graph',
  agentContext: {
    taskId: 'harness-factory-agent-task',
    description: 'Find a graph path'
  },
  agentReproduction: 'harness-factory-agent-proof'
});

assert.equal(isTrustedHarnessFactoryReport(report), true);
assert.equal(report.status, 'ADOPTED');
assert.equal(report.freshAdoption, true);
assert.equal(report.agentRunRequested, true);
assert.equal(report.agentBuilt, true);
assert.equal(report.agentRun.completed, true);
assert.equal(report.agentRun.attemptedEpisodes, 1);
assert.equal(report.agentRun.cycleCount, 1);
assert.equal(report.agentRun.provenActions, 1);
assert.equal(report.agentRun.observedActions, 0);
assert.equal(report.agentRun.auditValid, true);
assert.equal(report.agentRun.plannerId, 'harness-factory-agent-registered-planner-runtime');
assert.equal(report.agentProofStatus, 'PROVEN');
assert.equal(report.agentArchive.kind, 'agent-run');
assert.equal(report.agentArchive.sequence, 2);
assert.equal(typeof report.agentArchive.hash, 'string');
assert.equal(ledger.length, 2);
assert.equal(ledger.verify(), true);
const runs = ledger.restoreAgentRuns();
assert.equal(runs.length, 1);
assert.equal(runs[0].architectureId, report.adoptedCandidateId);
assert.equal(runs[0].completed, true);
assert.equal(Object.hasOwn(report, 'agent'), false);
assert.equal(Object.hasOwn(report, 'runReport'), false);
assert.equal(Object.hasOwn(report, 'actionReport'), false);
assert.equal(Object.hasOwn(report, 'planner'), false);
assert.equal(Object.hasOwn(report, 'runner'), false);
assert.equal(report.deployed, false);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);

console.log(
  `FLUID_HARNESS_FACTORY_AGENT_OK `
  + `status=${report.status} architecture=${report.adoptedCandidateId} `
  + `agentBuilt=${report.agentBuilt} completed=${report.agentRun.completed} `
  + `episodes=${report.agentRun.attemptedEpisodes} cycles=${report.agentRun.cycleCount} `
  + `proof=${report.agentProofStatus} archive=${report.agentArchive.kind}:${report.agentArchive.sequence} `
  + `deployed=${report.deployed}`
);
