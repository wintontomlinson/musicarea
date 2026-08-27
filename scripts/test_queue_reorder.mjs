/**
 * Reorder maths for the play queue.
 *
 * Mirrors two pieces of static/js/app.js that are easy to get subtly wrong and
 * awkward to exercise in a browser: the drop-target index adjustment in the
 * `drop` handler, and `Player.moveInQueue`. Both are pure index arithmetic, so
 * they can be checked exhaustively here rather than by dragging rows by hand.
 *
 * Run: node scripts/test_queue_reorder.mjs
 */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Player.moveInQueue, verbatim in behaviour. */
function moveInQueue(order, pos, fromOrderPos, toOrderPos) {
  const next = order.slice();
  const lastPos = next.length - 1;
  const from = clamp(fromOrderPos, 0, lastPos);
  const to = clamp(toOrderPos, pos + 1, lastPos);
  if (from === to || from <= pos) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** The drop handler's target -> destination conversion. */
function dropTarget(dragFromPos, targetPos, dropAfter) {
  let to = dropAfter ? targetPos + 1 : targetPos;
  if (to > dragFromPos) to -= 1;
  return to;
}

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures += 1;
    console.log(`  FAIL ${label}\n       got ${a}\n       want ${e}`);
  }
};

console.log('== moveInQueue: the playing track is immovable ==');
{
  const order = [0, 1, 2, 3, 4];
  const pos = 1;
  check('cannot move the current track', moveInQueue(order, pos, 1, 3), order);
  check('cannot move a played track', moveInQueue(order, pos, 0, 4), order);
  check('cannot drop onto the current slot', moveInQueue(order, pos, 4, 1), [0, 1, 4, 2, 3]);
  check('cannot drop above the current slot', moveInQueue(order, pos, 3, 0), [0, 1, 3, 2, 4]);
}

console.log('== moveInQueue: normal upcoming moves ==');
{
  const order = [10, 11, 12, 13, 14];
  check('move later',   moveInQueue(order, 0, 1, 3), [10, 12, 13, 11, 14]);
  check('move earlier', moveInQueue(order, 0, 4, 1), [10, 14, 11, 12, 13]);
  check('adjacent swap', moveInQueue(order, 0, 1, 2), [10, 12, 11, 13, 14]);
  check('no-op onto itself', moveInQueue(order, 0, 2, 2), order);
  check('past the end clamps', moveInQueue(order, 0, 1, 99), [10, 12, 13, 14, 11]);
}

console.log('== moveInQueue: the queue is only ever a permutation ==');
{
  const order = [0, 1, 2, 3, 4, 5, 6];
  const pos = 2;
  let permutationBroken = 0;
  let currentMoved = 0;
  for (let from = 0; from < order.length; from++) {
    for (let to = 0; to < order.length; to++) {
      const next = moveInQueue(order, pos, from, to);
      if (next.length !== order.length
          || new Set(next).size !== order.length
          || next.some((v) => !order.includes(v))) permutationBroken += 1;
      // The track that is playing must stay under the play head, or playback
      // would be cut off to satisfy a drag.
      if (next[pos] !== order[pos]) currentMoved += 1;
    }
  }
  check('every from/to pair stays a permutation', permutationBroken, 0);
  check('the playing track never leaves its slot', currentMoved, 0);
}

console.log('== drop index: dragging DOWN needs the -1, dragging UP does not ==');
{
  // order [A B C D E], playing A at pos 0. Drag B (1) below D (3).
  // Removing B first shifts D from 3 to 2, so the insert index is 3, not 4.
  check('B below D',       dropTarget(1, 3, true), 3);
  check('B above D',       dropTarget(1, 3, false), 2);
  check('E above B',       dropTarget(4, 1, false), 1);
  check('E below B',       dropTarget(4, 1, true), 2);
  check('onto itself, top half',    dropTarget(2, 2, false), 2);
  check('onto itself, bottom half', dropTarget(2, 2, true), 2);
}

console.log('== drop index: end to end against a reference splice ==');
{
  const base = ['A', 'B', 'C', 'D', 'E'];
  const pos = 0;
  let mismatches = 0;
  for (let from = 1; from < base.length; from++) {
    for (let target = 1; target < base.length; target++) {
      for (const after of [false, true]) {
        const to = dropTarget(from, target, after);
        const actual = moveInQueue(base, pos, from, to);

        // Reference: pull the row out, then insert it before or after the row it
        // was dropped on, identified by value rather than by index. Dropping a
        // row onto itself is a no-op, which has to be special cased here because
        // the anchor is the row that was just removed.
        let ref;
        if (from === target) {
          ref = base.slice();
        } else {
          ref = base.slice();
          const [moved] = ref.splice(from, 1);
          let insertAt = ref.indexOf(base[target]);
          if (after) insertAt += 1;
          ref.splice(insertAt, 0, moved);
        }

        if (JSON.stringify(actual) !== JSON.stringify(ref)) {
          mismatches += 1;
          console.log(`  FAIL from=${from} target=${target} after=${after}`
            + `\n       got  ${actual.join('')}\n       want ${ref.join('')}`);
        }
      }
    }
  }
  check('all 32 drag/drop combinations match the reference', mismatches, 0);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nPASS all queue reorder cases');
process.exit(failures ? 1 : 0);
