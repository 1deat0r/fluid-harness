import assert from 'node:assert/strict';

await import('../src/intrinsics.mjs');

const originalValues = Object.values;
try {
  Object.values = () => ['PROVEN'];
  const { questionFor } = await import('../src/curiosity.mjs?bootstrap-values-isolation');
  assert.throws(
    () => questionFor({
      actionReport: {
        evidence: 'PROVEN',
        surpriseBand: 'PROVEN'
      }
    }),
    /known surprise band/
  );
} finally {
  Object.values = originalValues;
}

const originalEntries = Object.entries;
const originalFromEntries = Object.fromEntries;
try {
  Object.entries = () => [];
  Object.fromEntries = () => ({});
  const { MutationProposal } = await import('../src/evolution.mjs?bootstrap-enumeration-isolation');
  const baseline = {
    productionSuccessRate: 0,
    productionProvenRate: 0,
    researchSuccessRate: 0,
    researchProvenRate: 0,
    skepticSuccessRate: 0,
    transferSuccessRate: 0,
    transferProvenRate: 0
  };
  const candidate = { ...baseline, productionSuccessRate: 1 };
  const proposal = new MutationProposal({
    id: 'bootstrap-enumeration-isolation',
    level: 1,
    baseline,
    candidate,
    reproducible: true
  });
  assert.equal(proposal.levelName, 'parameters');
} finally {
  Object.entries = originalEntries;
  Object.fromEntries = originalFromEntries;
}

console.log('FLUID_BOOTSTRAP_INTRINSIC_ISOLATION_OK');
