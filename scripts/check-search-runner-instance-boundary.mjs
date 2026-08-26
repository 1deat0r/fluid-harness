import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';
import { CognitiveCycleRunner } from '../src/cycle.mjs';
import {
  RepresentationSearchRunner,
  isTrustedSearchRunner
} from '../src/search.mjs';

const core = new ConstitutionalCore();
const valid = new RepresentationSearchRunner();
assert.equal(isTrustedSearchRunner(valid), true);
assert.doesNotThrow(() => new CognitiveCycleRunner({ core, searchRunner: valid }));

const spoofed = Object.freeze(Object.create(RepresentationSearchRunner.prototype));
assert.equal(spoofed instanceof RepresentationSearchRunner, true);
assert.equal(isTrustedSearchRunner(spoofed), false);
assert.throws(
  () => new CognitiveCycleRunner({ core: new ConstitutionalCore(), searchRunner: spoofed }),
  /trusted instance is required/
);

class DerivedSearchRunner extends RepresentationSearchRunner {}
const derived = new DerivedSearchRunner();
assert.equal(derived instanceof RepresentationSearchRunner, true);
assert.equal(isTrustedSearchRunner(derived), false);
assert.throws(
  () => new CognitiveCycleRunner({ core: new ConstitutionalCore(), searchRunner: derived }),
  /trusted instance is required/
);

const proxied = new Proxy(valid, {});
assert.equal(isTrustedSearchRunner(proxied), false);
assert.throws(
  () => new CognitiveCycleRunner({ core: new ConstitutionalCore(), searchRunner: proxied }),
  /trusted instance is required/
);

console.log('FLUID_SEARCH_RUNNER_INSTANCE_BOUNDARY_OK');
