const JSON_PARSE = JSON.parse;
const JSON_STRINGIFY = JSON.stringify;
const OBJECT_HAS_OWN = Object.hasOwn;
const PROCESS_EXIT = process.exit.bind(process);
const PROCESS_STDOUT_WRITE = process.stdout.write.bind(process.stdout);
const PROCESS_STDERR_WRITE = process.stderr.write.bind(process.stderr);
const STRING = String;
const PATH_TO_FILE_URL = (await import('node:url')).pathToFileURL;

const modulePath = process.argv[2];
const exportName = process.argv[3];
let rawInput = '';

function errorDetails(error) {
  return {
    name: typeof error?.name === 'string' ? error.name : 'Error',
    message: typeof error?.message === 'string' ? error.message : STRING(error)
  };
}

function writeFailure(error) {
  const payload = JSON_STRINGIFY({ ok: false, error: errorDetails(error) });
  PROCESS_STDOUT_WRITE(payload, () => PROCESS_EXIT(1));
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  rawInput += chunk;
});
process.stdin.on('end', async () => {
  try {
    if (typeof modulePath !== 'string' || modulePath === '') {
      throw new TypeError('Process-boundary module path is required');
    }
    if (typeof exportName !== 'string' || exportName === '') {
      throw new TypeError('Process-boundary export name is required');
    }
    const request = JSON_PARSE(rawInput);
    if (!request || typeof request !== 'object' || !OBJECT_HAS_OWN(request, 'input')) {
      throw new TypeError('Process-boundary request envelope is invalid');
    }
    const namespace = await import(PATH_TO_FILE_URL(modulePath).href);
    const candidate = namespace[exportName];
    if (typeof candidate !== 'function') {
      throw new TypeError(`Process-boundary export is not callable: ${exportName}`);
    }
    const value = await candidate(request.input);
    const payload = JSON_STRINGIFY({ ok: true, value });
    if (payload === undefined) {
      throw new TypeError('Process-boundary result must be JSON-compatible');
    }
    PROCESS_STDOUT_WRITE(payload, () => PROCESS_EXIT(0));
  } catch (error) {
    writeFailure(error);
  }
});
