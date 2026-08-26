export function complete({ task }) {
  return {
    text: `Fixture model response for: ${task.description}`,
    finishReason: 'stop'
  };
}

export function malformed() {
  return { text: '' };
}

export function nonObject() {
  return null;
}
