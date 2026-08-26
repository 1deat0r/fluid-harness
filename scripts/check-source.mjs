import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const sourceDirectories = ['src', 'test', 'scripts'];
const files = [];

function collect(directory) {
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(entryPath);
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(entryPath);
    }
  }
}

for (const directory of sourceDirectories) {
  collect(directory);
}

const failures = [];
for (const file of files.sort()) {
  const absolutePath = join(root, file);
  const contents = readFileSync(absolutePath, 'utf8');
  if (/[ \t]+$/m.test(contents)) {
    failures.push(`${file}: trailing whitespace`);
  }
  if (!contents.endsWith('\n')) {
    failures.push(`${file}: missing final newline`);
  }

  const syntax = spawnSync(process.execPath, ['--check', absolutePath], { encoding: 'utf8' });
  if (syntax.status !== 0) {
    failures.push(`${file}: syntax check failed`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`FLUID_SOURCE_OK files=${files.length} root=${relative(process.cwd(), root) || '.'}`);
}
