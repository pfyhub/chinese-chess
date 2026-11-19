import { RED, BLACK } from "./core.js";

/**
 * 根据一个重复周期内的着法，判定是否构成长将或长捉。
 * @param {Array<{mover: string, gaveCheck: boolean, chaseTargets: number[]}>} segment
 * @returns {{loser: string|null, reason: "perpetualcheck"|"perpetualchase"|null}}
 */
export function judgeRepetition(segment) {
  const sides = [RED, BLACK]
    .map((color) => ({
      color,
      moves: segment.filter((entry) => entry.mover === color),
    }))
    .filter((side) => side.moves.length > 0);

  const checkers = sides.filter((side) =>
    side.moves.every((entry) => entry.gaveCheck),
  );
  if (checkers.length === 1) {
    return { loser: checkers[0].color, reason: "perpetualcheck" };
  }
  if (checkers.length > 1) {
    return { loser: null, reason: null };
  }

  const chasers = sides.filter((side) => {
    let common = null;
    for (const entry of side.moves) {
      const ids = new Set(entry.chaseTargets || []);
      common =
        common === null
          ? ids
          : new Set([...common].filter((id) => ids.has(id)));
    }
    return common !== null && common.size > 0;
  });
  if (chasers.length === 1) {
    return { loser: chasers[0].color, reason: "perpetualchase" };
  }

  return { loser: null, reason: null };
}
