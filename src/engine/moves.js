import {
  ROWS,
  COLS,
  RED,
  OPPOSITE,
  inside,
  inPalace,
  ownSide,
  crossedRiver,
  findKing,
  clearBetween,
  cloneBoard,
} from "./core.js";

const ORTHO = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const DIAG = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const HORSE = [
  [-2, -1, -1, 0],
  [-2, 1, -1, 0],
  [2, -1, 1, 0],
  [2, 1, 1, 0],
  [-1, -2, 0, -1],
  [1, -2, 0, -1],
  [-1, 2, 0, 1],
  [1, 2, 0, 1],
];

export function getPseudoMoves(board, r, c, options = {}) {
  const piece = board[r][c];
  if (!piece) return [];

  const standard = options.mode === "standard";
  const role = piece.revealed ? piece.kind : piece.homeRole;
  const moves = [];

  const add = (rr, cc) => {
    if (!inside(rr, cc)) return;
    const target = board[rr][cc];
    if (!target || target.color !== piece.color) {
      moves.push({ r: rr, c: cc });
    }
  };

  if (role === "R") {
    for (const [dr, dc] of ORTHO) {
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc)) {
        const target = board[rr][cc];
        if (!target) {
          moves.push({ r: rr, c: cc });
        } else {
          if (target.color !== piece.color) moves.push({ r: rr, c: cc });
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  } else if (role === "C") {
    for (const [dr, dc] of ORTHO) {
      let rr = r + dr;
      let cc = c + dc;
      let screen = false;
      while (inside(rr, cc)) {
        const target = board[rr][cc];
        if (!screen) {
          if (!target) {
            moves.push({ r: rr, c: cc });
          } else {
            screen = true;
          }
        } else if (target) {
          if (target.color !== piece.color) moves.push({ r: rr, c: cc });
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  } else if (role === "H") {
    for (const [dr, dc, legR, legC] of HORSE) {
      const lr = r + legR;
      const lc = c + legC;
      if (inside(lr, lc) && board[lr][lc]) continue;
      add(r + dr, c + dc);
    }
  } else if (role === "E") {
    for (const [dr, dc] of DIAG) {
      const eyeR = r + dr;
      const eyeC = c + dc;
      const toR = r + dr * 2;
      const toC = c + dc * 2;
      if (!inside(toR, toC)) continue;
      if (board[eyeR][eyeC]) continue;
      if ((standard || !piece.revealed) && !ownSide(piece.color, toR)) continue;
      add(toR, toC);
    }
  } else if (role === "A") {
    for (const [dr, dc] of DIAG) {
      const toR = r + dr;
      const toC = c + dc;
      if (!inside(toR, toC)) continue;
      if ((standard || !piece.revealed) && !inPalace(piece.color, toR, toC)) continue;
      add(toR, toC);
    }
  } else if (role === "K") {
    for (const [dr, dc] of ORTHO) {
      const toR = r + dr;
      const toC = c + dc;
      if (!inside(toR, toC)) continue;
      if (!inPalace(piece.color, toR, toC)) continue;
      add(toR, toC);
    }
  } else if (role === "P") {
    const forward = piece.color === RED ? -1 : 1;
    add(r + forward, c);
    if (piece.revealed && crossedRiver(piece.color, r)) {
      add(r, c - 1);
      add(r, c + 1);
    }
  }

  return moves;
}

export function isInCheck(board, color, options = {}) {
  const king = findKing(board, color);
  if (!king) return false;

  const enemy = OPPOSITE[color];
  const enemyKing = findKing(board, enemy);
  if (enemyKing && enemyKing.c === king.c && clearBetween(board, enemyKing, king)) {
    return true;
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== enemy) continue;
      const attacks = getPseudoMoves(board, r, c, options);
      if (attacks.some((move) => move.r === king.r && move.c === king.c)) {
        return true;
      }
    }
  }

  return false;
}

export function getAttackedEnemyIds(board, color, options = {}) {
  const ids = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;
      for (const move of getPseudoMoves(board, r, c, options)) {
        const target = board[move.r][move.c];
        if (target && target.color !== color && target.kind !== "K") {
          ids.add(target.id);
        }
      }
    }
  }
  return ids;
}

export function applyMove(board, move) {
  const next = cloneBoard(board);
  const piece = next[move.from.r][move.from.c];
  const captured = next[move.to.r][move.to.c];
  const revealedPiece = piece.revealed ? piece : { ...piece, revealed: true };

  next[move.to.r][move.to.c] = revealedPiece;
  next[move.from.r][move.from.c] = null;

  return {
    board: next,
    captured,
    wasReveal: !piece.revealed,
    piece: revealedPiece,
  };
}

export function getLegalMovesFrom(board, color, r, c, options = {}) {
  const piece = board[r][c];
  if (!piece || piece.color !== color) return [];

  return getPseudoMoves(board, r, c, options)
    .filter((to) => {
      const move = { from: { r, c }, to };
      const simulated = applyMove(board, move);
      return !isInCheck(simulated.board, color, options);
    })
    .map((to) => ({ from: { r, c }, to }));
}

export function getLegalMoves(board, color, options = {}) {
  const legal = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;
      legal.push(...getLegalMovesFrom(board, color, r, c, options));
    }
  }
  return legal;
}
