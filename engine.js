export const DIRECTIONS = ['up', 'right', 'down', 'left'];

export function cells(state) {
  const result = [[state.x, state.z]];
  if (state.o === 'x') result.push([state.x + 1, state.z]);
  if (state.o === 'z') result.push([state.x, state.z + 1]);
  return result;
}

export function roll(state, direction) {
  const next = { ...state };
  const { o } = state;
  if (direction === 'right') {
    next.x += o === 'u' ? 1 : o === 'x' ? 2 : 1;
    if (o !== 'z') next.o = o === 'u' ? 'x' : 'u';
  } else if (direction === 'left') {
    next.x -= o === 'u' ? 2 : 1;
    if (o !== 'z') next.o = o === 'u' ? 'x' : 'u';
  } else if (direction === 'down') {
    next.z += o === 'u' ? 1 : o === 'z' ? 2 : 1;
    if (o !== 'x') next.o = o === 'u' ? 'z' : 'u';
  } else if (direction === 'up') {
    next.z -= o === 'u' ? 2 : 1;
    if (o !== 'x') next.o = o === 'u' ? 'z' : 'u';
  } else {
    throw new Error(`Unknown direction: ${direction}`);
  }
  return next;
}

export function tileAt(level, x, z) {
  return level.map[z]?.[x] || '.';
}

export function initialState(level) {
  for (let z = 0; z < level.map.length; z++) {
    const x = level.map[z].indexOf('S');
    if (x >= 0) return { x, z, o: 'u', mask: 0 };
  }
  throw new Error('Level has no start tile');
}

export function move(level, state, direction) {
  const next = roll(state, direction);
  const occupied = cells(next);
  const supported = occupied.every(([x, z]) => {
    const tile = tileAt(level, x, z);
    return tile !== '.' && tile !== ' ' && (tile !== 'B' || Boolean(next.mask & 1));
  });
  if (!supported) return { state: next, status: 'fall' };
  const tile = tileAt(level, next.x, next.z);
  if (next.o === 'u' && tile === 'F') return { state: next, status: 'fragile' };
  if (next.o === 'u' && tile === 'T') next.mask ^= 1;
  return { state: next, status: next.o === 'u' && tile === 'G' ? 'win' : 'ok' };
}

export function solve(level, start = initialState(level)) {
  const key = state => `${state.x},${state.z},${state.o},${state.mask}`;
  const queue = [{ state: start, path: [] }];
  const visited = new Set([key(start)]);
  for (let index = 0; index < queue.length; index++) {
    const { state, path } = queue[index];
    for (const direction of DIRECTIONS) {
      const result = move(level, state, direction);
      if (result.status === 'win') return [...path, direction];
      if (result.status !== 'ok' || visited.has(key(result.state))) continue;
      visited.add(key(result.state));
      queue.push({ state: result.state, path: [...path, direction] });
    }
  }
  return null;
}
