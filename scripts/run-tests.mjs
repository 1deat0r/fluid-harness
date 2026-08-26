import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['--test'], { stdio: 'inherit' });

if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  console.log('FLUID_TESTS_OK');
}
