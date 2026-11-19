export const ROWS = 10;
export const COLS = 9;

export const RED = "red";
export const BLACK = "black";

export const OPPOSITE = { red: "black", black: "red" };

export const KIND_LABEL = {
  red: { K: "帅", A: "仕", E: "相", H: "马", R: "车", C: "炮", P: "兵" },
  black: { K: "将", A: "士", E: "象", H: "马", R: "车", C: "炮", P: "卒" },
};

export const HOME_LAYOUT = [
  ["R", "H", "E", "A", "K", "A", "E", "H", "R"],
  [null, null, null, null, null, null, null, null, null],
  [null, "C", null, null, null, null, null, "C", null],
  ["P", null, "P", null, "P", null, "P", null, "P"],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  ["P", null, "P", null, "P", null, "P", null, "P"],
  [null, "C", null, null, null, null, null, "C", null],
  [null, null, null, null, null, null, null, null, null],
  ["R", "H", "E", "A", "K", "A", "E", "H", "R"],
];

export const NON_KING_KINDS = [
  "R", "R", "H", "H", "E", "E", "A", "A", "C", "C", "P", "P", "P", "P", "P",
];

export function inside(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

export function inPalace(color, r, c) {
  if (!inside(r, c) || c < 3 || c > 5) return false;
  return color === RED ? r >= 7 : r <= 2;
}

export function ownSide(color, r) {
  return color === RED ? r >= 5 : r <= 4;
}

export function crossedRiver(color, r) {
  return color === RED ? r <= 4 : r >= 5;
}

export function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

let nextId = 1;

export function resetPieceIds() {
  nextId = 1;
}

export function makePiece(color, kind, homeRole, revealed = false) {
  return { id: nextId++, color, kind, homeRole, revealed };
}

export function findKing(board, color) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color && piece.kind === "K") {
        return { r, c };
      }
    }
  }
  return null;
}

export function clearBetween(board, a, b) {
  if (a.r === b.r) {
    const lo = Math.min(a.c, b.c);
    const hi = Math.max(a.c, b.c);
    for (let c = lo + 1; c < hi; c++) {
      if (board[a.r][c]) return false;
    }
    return true;
  }
  if (a.c === b.c) {
    const lo = Math.min(a.r, b.r);
    const hi = Math.max(a.r, b.r);
    for (let r = lo + 1; r < hi; r++) {
      if (board[r][b.c]) return false;
    }
    return true;
  }
  return false;
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}
