import { OPPOSITE } from "./core.js";
import { applyMove, getLegalMoves, isInCheck } from "./moves.js";
import { judgeRepetition } from "./repetition.js";

export const AI_DIFFICULTIES = {
  normal: { label: "一般", depth: 2, timeLimit: 500 },
  medium: { label: "中等", depth: 3, timeLimit: 1500 },
  hard: { label: "困难", depth: 4, timeLimit: 3500 },
};

const VALUES = { K: 10000, R: 9, C: 4.5, H: 4, E: 2, A: 2, P: 1 };
const HIDDEN_VALUE = 3.2;
const MATE = 100000;
const SEARCH_TIMEOUT = Symbol("search-timeout");

// 重复局面惩罚：促使 AI 推进局面，而不是反复将军或来回挪子
const REPEAT_PENALTY = 0.8;

/**
 * 预判这一手走完后的重复情况。
 * repeats：该局面此前出现过几次；losing：这一手是否会构成长将/长捉判负。
 */
function inspectRepetition(game, move, color, rules) {
  const next = applyMove(game.board, move).board;
  const nextTurn = OPPOSITE[color];
  const plies = game.positionCounts.get(game.positionKey(next, nextTurn)) || [];
  const gaveCheck = isInCheck(next, nextTurn, rules);
  let losing = false;

  // 该局面此前出现过一次就足以判定循环性质：若这个循环会被判我方长将/长捉负，
  // 提前换招，不必等到第三次重复真的发生
  if (plies.length >= 1) {
    const segment = game.history.slice(plies[0]).map((entry) => ({
      mover: entry.mover,
      gaveCheck: entry.gaveCheck,
      chaseTargets: entry.chaseTargets,
    }));
    // 候选走法的捉子信息这里留空：只用于判定长将，长捉的情况不误判为输
    segment.push({ mover: color, gaveCheck, chaseTargets: [] });
    losing = judgeRepetition(segment).loser === color;
  }

  return { repeats: plies.length, losing };
}

// AI 只知道自己暗子的真实身份，对手暗子按平均价值估算。
function pieceValue(piece, aiColor) {
  if (!piece.revealed && piece.color !== aiColor) return HIDDEN_VALUE;
  return VALUES[piece.kind] ?? 0;
}

function evaluate(board, perspective, aiColor) {
  let score = 0;
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const sign = piece.color === perspective ? 1 : -1;
      score += sign * pieceValue(piece, aiColor);

      if (piece.revealed && piece.kind === "P") {
        const advance = piece.color === "red" ? 9 - r : r;
        score += sign * advance * 0.05;
      }
    }
  }
  return score;
}

function captureScore(board, move) {
  const victim = board[move.to.r][move.to.c];
  if (!victim) return 0;
  const attacker = board[move.from.r][move.from.c];
  const victimValue = victim.revealed ? VALUES[victim.kind] ?? 0 : 2;
  const attackerValue = attacker.revealed ? VALUES[attacker.kind] ?? 0 : 2;
  return 100 + victimValue * 10 - attackerValue;
}

function orderMoves(board, moves) {
  return moves
    .slice()
    .sort((a, b) => captureScore(board, b) - captureScore(board, a));
}

function checkDeadline(deadline) {
  if (Date.now() >= deadline) throw SEARCH_TIMEOUT;
}

function search(board, turn, depth, alpha, beta, aiColor, rules, deadline) {
  checkDeadline(deadline);
  if (depth === 0) return evaluate(board, turn, aiColor);

  const moves = getLegalMoves(board, turn, rules);
  if (moves.length === 0) return -MATE;

  let best = -Infinity;
  for (const move of orderMoves(board, moves)) {
    const next = applyMove(board, move).board;
    const score = -search(
      next,
      OPPOSITE[turn],
      depth - 1,
      -beta,
      -alpha,
      aiColor,
      rules,
      deadline,
    );
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function sameMove(a, b) {
  return (
    a.from.r === b.from.r &&
    a.from.c === b.from.c &&
    a.to.r === b.to.r &&
    a.to.c === b.to.c
  );
}

export function chooseMove(game, color, options = {}) {
  const maxDepth = options.depth ?? 2;
  const timeLimit = options.timeLimit ?? Infinity;
  const deadline = Number.isFinite(timeLimit)
    ? Date.now() + timeLimit
    : Infinity;
  const rng = options.rng ?? Math.random;
  const rules = { mode: game.mode ?? "jieqi" };
  const board = game.board;

  let rootMoves = orderMoves(board, getLegalMoves(board, color, rules));
  if (rootMoves.length === 0) return null;

  const repetition = new Map();
  for (const move of rootMoves) {
    repetition.set(move, inspectRepetition(game, move, color, rules));
  }

  // 会因长将判负的走法直接排除；若全部判负则保留候选，至少还能走子
  const safeMoves = rootMoves.filter((move) => !repetition.get(move).losing);
  if (safeMoves.length > 0) {
    rootMoves = safeMoves;
  }

  let bestMove = rootMoves[0];

  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      const scored = [];
      let alpha = -Infinity;

      for (const move of rootMoves) {
        checkDeadline(deadline);
        const next = applyMove(board, move).board;
        const penalty = repetition.get(move).repeats >= 1 ? REPEAT_PENALTY : 0;
        const score =
          -search(
            next,
            OPPOSITE[color],
            depth - 1,
            -Infinity,
            -alpha,
            color,
            rules,
            deadline,
          ) - penalty;
        scored.push({ move, score });
        if (score > alpha) alpha = score;
      }

      const bestScore = Math.max(...scored.map((item) => item.score));
      const pool = scored.filter((item) => item.score >= bestScore - 0.001);
      bestMove = pool[Math.floor(rng() * pool.length)].move;

      rootMoves = [
        bestMove,
        ...rootMoves.filter((move) => !sameMove(move, bestMove)),
      ];

      if (Date.now() >= deadline) break;
    }
  } catch (error) {
    if (error !== SEARCH_TIMEOUT) throw error;
  }

  return bestMove;
}
