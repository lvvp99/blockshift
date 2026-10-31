import test from 'node:test';
import assert from 'node:assert/strict';
import { cells, roll, move, initialState, solve, DIRECTIONS } from '../engine.js';
import { levels } from '../levels.js';

test('rolling respects all three orientations and reverses exactly', () => {
  const reverse = { up: 'down', down: 'up', left: 'right', right: 'left' };
  for (const o of ['u', 'x', 'z']) {
    for (const direction of DIRECTIONS) {
      const state = { x: 5, z: 5, o, mask: 1 };
      assert.deepEqual(roll(roll(state, direction), reverse[direction]), state);
    }
  }
  assert.deepEqual(cells({ x: 2, z: 3, o: 'x' }), [[2,3], [3,3]]);
  assert.deepEqual(cells({ x: 2, z: 3, o: 'z' }), [[2,3], [2,4]]);
});

test('both halves need support and lying on a goal does not win', () => {
  assert.equal(move({ map: ['S#.'] }, { x: 0, z: 0, o: 'u', mask: 0 }, 'right').status, 'fall');
  const level = { map: ['S#G#'] };
  const result = move(level, initialState(level), 'right');
  assert.equal(result.status, 'ok');
  assert.equal(result.state.o, 'x');
  assert.equal(move({ map: ['S##G'] }, initialState(level), 'right').status, 'ok');
  const flat = { x: 1, z: 0, o: 'x', mask: 0 };
  assert.equal(move({ map: ['S##G'] }, flat, 'right').status, 'win');
});

test('fragile tiles support a flat block but break under an upright one', () => {
  const level = { map: ['SFFF'] };
  const flat = move(level, initialState(level), 'right');
  assert.equal(flat.status, 'ok');
  assert.equal(move(level, flat.state, 'right').status, 'fragile');
});

test('upright switches toggle bridges; flat blocks leave switches alone', () => {
  const level = { map: ['S##TBB#'] };
  const flat = move(level, initialState(level), 'right');
  const activated = move(level, flat.state, 'right');
  assert.equal(activated.state.mask, 1);
  assert.equal(move(level, activated.state, 'right').status, 'ok');
  assert.equal(move(level, { ...activated.state, mask: 0 }, 'right').status, 'fall');
  assert.equal(move({ map: ['S#T#'] }, initialState(level), 'right').state.mask, 0);
  const switchedOff = move(level, { x: 4, z: 0, o: 'x', mask: 1 }, 'left');
  assert.equal(switchedOff.state.mask, 0);
});

test('every included level has a legal, winning solution', () => {
  for (const level of levels) {
    assert.equal(level.map.join('').split('S').length - 1, 1);
    assert.equal(level.map.join('').split('G').length - 1, 1);
    const solution = solve(level);
    assert.ok(solution?.length, `${level.name} must be solvable`);
    let state = initialState(level);
    solution.forEach((direction, i) => {
      const result = move(level, state, direction);
      assert.equal(result.status, i === solution.length - 1 ? 'win' : 'ok', `${level.name}, step ${i+1}`);
      state = result.state;
    });
  }
});

test('hints can recover a solution from intermediate bridge states', () => {
  const level = levels[7];
  const path = solve(level);
  let state = initialState(level);
  for (const direction of path.slice(0, 12)) state = move(level, state, direction).state;
  const hintPath = solve(level, state);
  assert.ok(hintPath?.length);
  assert.equal(hintPath.length, path.length - 12);
});
