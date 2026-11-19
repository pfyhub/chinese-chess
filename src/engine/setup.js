import {
  ROWS,
  COLS,
  RED,
  BLACK,
  HOME_LAYOUT,
  NON_KING_KINDS,
  emptyBoard,
  makePiece,
  resetPieceIds,
} from "./core.js";

export function shuffle(items, rng = Math.random) {
  const array = items.slice();
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function createBoard(rng = Math.random) {
  resetPieceIds();
  const board = emptyBoard();

  board[0][4] = makePiece(BLACK, "K", "K", true);
  board[9][4] = makePiece(RED, "K", "K", true);

  for (const color of [RED, BLACK]) {
    const homes = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const role = HOME_LAYOUT[r][c];
        if (!role || role === "K") continue;
        const isRedSide = r >= 5;
        if ((color === RED) !== isRedSide) continue;
        homes.push({ r, c, role });
      }
    }

    const kinds = shuffle(NON_KING_KINDS, rng);
    homes.forEach((home, index) => {
      board[home.r][home.c] = makePiece(color, kinds[index], home.role, false);
    });
  }

  return board;
}

export function createStandardBoard() {
  resetPieceIds();
  const board = emptyBoard();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const role = HOME_LAYOUT[r][c];
      if (!role) continue;
      const color = r >= 5 ? RED : BLACK;
      board[r][c] = makePiece(color, role, role, true);
    }
  }

  return board;
}
