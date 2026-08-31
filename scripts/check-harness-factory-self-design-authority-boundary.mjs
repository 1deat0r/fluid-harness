import assert from 'node:assert/strict';

import { AgentPlannerCase } from '../src/agent-search.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  buildHarnessFactorySelfDesignFixture
} from './fixtures/harness-factory-self-design.mjs';

const fixture = buildHarnessFactorySelfDesignFixture({
  prefix: 'harness-factory-self-design-authority-boundary'
});
const { factory, ledger, selfDesignOptions } = fixture;
const beforeRejected = ledger.serialize();
assert.throws(
  () => factory.selfDesignAndManufacture(selfDesignOptions({ researchContext: {} })),
  /enumerable data properties/
);
assert.throws(
  () => factory.selfDesignAndManufacture(selfDesignOptions({ archive: false })),
  /enumerable data properties/
);
assert.throws(
  () => factory.selfDesignAndManufacture(selfDesignOptions({ unknown: true })),
  /enumerable data properties/
);
const accessorOptions = selfDesignOptions();
Object.defineProperty(accessorOptions, 'agentGoal', {
  enumerable: true,
  get() {
    return 'graph';
  }
});
assert.throws(
  () => factory.selfDesignAndManufacture(accessorOptions),
  /enumerable data properties/
);
const cyclicContext = {};
cyclicContext.self = cyclicContext;
assert.throws(
  () => factory.selfDesignAndManufacture(selfDesignOptions({ agentContext: cyclicContext })),
  /must not contain cycles/
);
assert.throws(
  () => factory.selfDesignAndManufacture(selfDesignOptions({ toolRegistry: {} })),
  /trusted ToolRegistry/
);
assert.throws(
  () => new Proxy(factory, {}).selfDesignAndManufacture(selfDesignOptions()),
  /exact trusted factory/
);
assert.equal(ledger.serialize(), beforeRejected);

const failedHoldout = new AgentPlannerCase({
  id: 'harness-factory-self-design-failed-holdout',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-self-design-failed-holdout-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-self-design-failed-holdout-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (runReport) => runReport?.completed === true
    && runReport.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
    && false
});
assert.throws(
  () => factory.selfDesignAndManufacture(selfDesignOptions({
    holdoutCases: [failedHoldout]
  })),
  /holdout benchmark rejected/
);
assert.equal(ledger.restoreAgentRuns().length, 0);
const failedDiscovery = ledger.restoreArchitectureDiscoveries()[0];
assert.equal(failedDiscovery.factory.status, 'REJECTED');
assert.equal(failedDiscovery.factory.holdout.passed, false);
assert.equal(failedDiscovery.deployed, false);
assert.equal(failedDiscovery.authorityTransferred, false);

const tampered = JSON.parse(ledger.serialize());
tampered.records[0].payload.shiftedWeaknessCount = 99;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash verification failed|fingerprint verification failed|invalid shape|inconsistent/
);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_SELF_DESIGN_AUTHORITY_BOUNDARY_OK `
  + `researchInjectionRejected=true archiveSuppressionRejected=true unknownRejected=true `
  + `accessorRejected=true cycleRejected=true toolRejected=true proxyRejected=true `
  + `tamperedRejected=true failedHoldoutArchived=true agentExposed=false `
  + `deployed=${failedDiscovery.deployed} authorityTransferred=${failedDiscovery.authorityTransferred} `
  + `verify=${ledger.verify()}`
);
