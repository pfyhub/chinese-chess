var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// wechat-game/js/engine-entry.js
var engine_entry_exports = {};
__export(engine_entry_exports, {
  AI_DIFFICULTIES: () => AI_DIFFICULTIES,
  BASE_H: () => BASE_H,
  BASE_W: () => BASE_W,
  BLACK: () => BLACK,
  COLS: () => COLS,
  JieqiGame: () => JieqiGame,
  KIND_LABEL: () => KIND_LABEL,
  RED: () => RED,
  ROWS: () => ROWS,
  chooseMove: () => chooseMove,
  clearMatch: () => clearMatch,
  drawBoard: () => drawBoard,
  hitTestPoint: () => hitTestPoint,
  loadMatch: () => loadMatch,
  saveMatch: () => saveMatch
});
module.exports = __toCommonJS(engine_entry_exports);

// src/engine/core.js
var ROWS = 10;
var COLS = 9;
var RED = "red";
var BLACK = "black";
var OPPOSITE = { red: "black", black: "red" };
var KIND_LABEL = {
  red: { K: "\u5E05", A: "\u4ED5", E: "\u76F8", H: "\u9A6C", R: "\u8F66", C: "\u70AE", P: "\u5175" },
  black: { K: "\u5C06", A: "\u58EB", E: "\u8C61", H: "\u9A6C", R: "\u8F66", C: "\u70AE", P: "\u5352" }
};
var HOME_LAYOUT = [
  ["R", "H", "E", "A", "K", "A", "E", "H", "R"],
  [null, null, null, null, null, null, null, null, null],
  [null, "C", null, null, null, null, null, "C", null],
  ["P", null, "P", null, "P", null, "P", null, "P"],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  ["P", null, "P", null, "P", null, "P", null, "P"],
  [null, "C", null, null, null, null, null, "C", null],
  [null, null, null, null, null, null, null, null, null],
  ["R", "H", "E", "A", "K", "A", "E", "H", "R"]
];
var NON_KING_KINDS = [
  "R",
  "R",
  "H",
  "H",
  "E",
  "E",
  "A",
  "A",
  "C",
  "C",
  "P",
  "P",
  "P",
  "P",
  "P"
];
function inside(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}
function inPalace(color, r, c) {
  if (!inside(r, c) || c < 3 || c > 5) return false;
  return color === RED ? r >= 7 : r <= 2;
}
function ownSide(color, r) {
  return color === RED ? r >= 5 : r <= 4;
}
function crossedRiver(color, r) {
  return color === RED ? r <= 4 : r >= 5;
}
function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}
var nextId = 1;
function resetPieceIds() {
  nextId = 1;
}
function makePiece(color, kind, homeRole, revealed = false) {
  return { id: nextId++, color, kind, homeRole, revealed };
}
function findKing(board, color) {
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
function clearBetween(board, a, b) {
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
function cloneBoard(board) {
  return board.map((row) => row.slice());
}

// src/engine/setup.js
function shuffle(items, rng = Math.random) {
  const array = items.slice();
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function createBoard(rng = Math.random) {
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
        if (color === RED !== isRedSide) continue;
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
function createStandardBoard() {
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

// src/engine/moves.js
var ORTHO = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];
var DIAG = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1]
];
var HORSE = [
  [-2, -1, -1, 0],
  [-2, 1, -1, 0],
  [2, -1, 1, 0],
  [2, 1, 1, 0],
  [-1, -2, 0, -1],
  [1, -2, 0, -1],
  [-1, 2, 0, 1],
  [1, 2, 0, 1]
];
function getPseudoMoves(board, r, c, options = {}) {
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
function isInCheck(board, color, options = {}) {
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
function getAttackedEnemyIds(board, color, options = {}) {
  const ids = /* @__PURE__ */ new Set();
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
function applyMove(board, move) {
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
    piece: revealedPiece
  };
}
function getLegalMovesFrom(board, color, r, c, options = {}) {
  const piece = board[r][c];
  if (!piece || piece.color !== color) return [];
  return getPseudoMoves(board, r, c, options).filter((to) => {
    const move = { from: { r, c }, to };
    const simulated = applyMove(board, move);
    return !isInCheck(simulated.board, color, options);
  }).map((to) => ({ from: { r, c }, to }));
}
function getLegalMoves(board, color, options = {}) {
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

// src/engine/repetition.js
function judgeRepetition(segment) {
  const sides = [RED, BLACK].map((color) => ({
    color,
    moves: segment.filter((entry) => entry.mover === color)
  })).filter((side) => side.moves.length > 0);
  const checkers = sides.filter(
    (side) => side.moves.every((entry) => entry.gaveCheck)
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
      common = common === null ? ids : new Set([...common].filter((id) => ids.has(id)));
    }
    return common !== null && common.size > 0;
  });
  if (chasers.length === 1) {
    return { loser: chasers[0].color, reason: "perpetualchase" };
  }
  return { loser: null, reason: null };
}

// src/engine/game.js
function clonePiece(piece) {
  return piece ? { ...piece } : null;
}
function cloneLastMove(lastMove) {
  if (!lastMove) return null;
  return {
    ...lastMove,
    from: { ...lastMove.from },
    to: { ...lastMove.to },
    capture: lastMove.capture ? { ...lastMove.capture } : null
  };
}
function cloneSnapshot(snapshot) {
  return {
    board: snapshot.board.map((row) => row.map(clonePiece)),
    turn: snapshot.turn,
    capturedBy: {
      red: snapshot.capturedBy.red.map(clonePiece),
      black: snapshot.capturedBy.black.map(clonePiece)
    },
    quietPlies: snapshot.quietPlies,
    revealedCount: snapshot.revealedCount,
    status: snapshot.status,
    winner: snapshot.winner,
    drawReason: snapshot.drawReason,
    lastMove: cloneLastMove(snapshot.lastMove),
    inCheck: snapshot.inCheck
  };
}
var JieqiGame = class _JieqiGame {
  constructor(options = {}) {
    this.quietLimit = options.quietLimit ?? 80;
    this.mode = options.mode ?? "jieqi";
    this.reset(options.rng);
  }
  static fromArchive(archive) {
    if (!archive || !["jieqi", "standard"].includes(archive.mode)) {
      throw new Error("\u5B58\u6863\u6A21\u5F0F\u65E0\u6548");
    }
    if (!archive.initial || !Array.isArray(archive.moves)) {
      throw new Error("\u5B58\u6863\u7F3A\u5C11\u5F00\u5C40\u6216\u8D70\u5B50\u8BB0\u5F55");
    }
    const game = new _JieqiGame({
      mode: archive.mode,
      quietLimit: archive.quietLimit ?? 80
    });
    game.restoreInitial(archive.initial);
    for (let index = 0; index < archive.moves.length; index++) {
      const result = game.play(archive.moves[index]);
      if (!result.ok) {
        throw new Error(`\u5B58\u6863\u7B2C ${index + 1} \u624B\u65E0\u6548\uFF1A${result.reason}`);
      }
    }
    return game;
  }
  reset(rng = Math.random) {
    this.board = this.mode === "standard" ? createStandardBoard() : createBoard(rng);
    this.turn = RED;
    this.capturedBy = { red: [], black: [] };
    this.history = [];
    this.quietPlies = 0;
    this.revealedCount = 0;
    this.status = "playing";
    this.winner = null;
    this.drawReason = null;
    this.lastMove = null;
    this.inCheck = false;
    this.positionCounts = /* @__PURE__ */ new Map();
    this.recordPosition();
    this.refreshStatus();
    this.snapshots = [this.createSnapshot()];
  }
  createSnapshot() {
    return cloneSnapshot(this);
  }
  snapshotAt(ply) {
    if (!Number.isInteger(ply) || ply < 0 || ply >= this.snapshots.length) {
      return null;
    }
    return cloneSnapshot(this.snapshots[ply]);
  }
  restoreSnapshot(snapshot) {
    const restored = cloneSnapshot(snapshot);
    this.board = restored.board;
    this.turn = restored.turn;
    this.capturedBy = restored.capturedBy;
    this.quietPlies = restored.quietPlies;
    this.revealedCount = restored.revealedCount;
    this.status = restored.status;
    this.winner = restored.winner;
    this.drawReason = restored.drawReason;
    this.lastMove = restored.lastMove;
    this.inCheck = restored.inCheck;
  }
  restoreInitial(snapshot) {
    this.restoreSnapshot(snapshot);
    this.history = [];
    this.status = "playing";
    this.winner = null;
    this.drawReason = null;
    this.positionCounts = /* @__PURE__ */ new Map();
    this.recordPosition();
    this.refreshStatus();
    this.snapshots = [this.createSnapshot()];
  }
  undoTo(ply) {
    if (!Number.isInteger(ply) || ply < 0 || ply >= this.snapshots.length) {
      return false;
    }
    this.restoreSnapshot(this.snapshots[ply]);
    this.history = this.history.slice(0, ply);
    this.snapshots = this.snapshots.slice(0, ply + 1);
    this.rebuildPositionCounts();
    return true;
  }
  toArchive() {
    return {
      mode: this.mode,
      quietLimit: this.quietLimit,
      initial: this.snapshotAt(0),
      moves: this.history.map(({ move }) => ({
        from: { ...move.from },
        to: { ...move.to }
      }))
    };
  }
  positionKey(board = this.board, turn = this.turn) {
    const cells = board.map(
      (row) => row.map((piece) => {
        if (!piece) return ".";
        return `${piece.color[0]}${piece.kind}${piece.revealed ? "1" : "0"}${piece.homeRole}`;
      }).join("")
    ).join("/");
    return `${turn}|${cells}`;
  }
  recordPosition() {
    const key = this.positionKey();
    const plies = this.positionCounts.get(key) || [];
    plies.push(this.history.length);
    this.positionCounts.set(key, plies);
  }
  rebuildPositionCounts() {
    this.positionCounts = /* @__PURE__ */ new Map();
    this.snapshots.forEach((snapshot, ply) => {
      const key = this.positionKey(snapshot.board, snapshot.turn);
      const plies = this.positionCounts.get(key) || [];
      plies.push(ply);
      this.positionCounts.set(key, plies);
    });
  }
  refreshStatus() {
    if (this.status === "kingcaptured") return;
    const legal = getLegalMoves(this.board, this.turn, { mode: this.mode });
    this.inCheck = isInCheck(this.board, this.turn, { mode: this.mode });
    if (legal.length === 0) {
      this.winner = OPPOSITE[this.turn];
      this.status = this.inCheck ? "checkmate" : "stalemate";
      return;
    }
    const plies = this.positionCounts.get(this.positionKey()) || [];
    if (plies.length >= 3) {
      const verdict = judgeRepetition(this.history.slice(plies[0]));
      if (verdict.loser) {
        this.winner = OPPOSITE[verdict.loser];
        this.status = verdict.reason;
        return;
      }
      this.status = "draw";
      this.drawReason = "repetition";
      this.winner = null;
      return;
    }
    if (this.quietPlies >= this.quietLimit) {
      this.status = "draw";
      this.drawReason = "quiet";
      this.winner = null;
      return;
    }
    this.status = "playing";
  }
  getLegalMovesFrom(r, c) {
    if (this.status !== "playing") return [];
    return getLegalMovesFrom(this.board, this.turn, r, c, { mode: this.mode });
  }
  play(move) {
    if (this.status !== "playing") {
      return { ok: false, reason: "\u5BF9\u5C40\u5DF2\u7ED3\u675F" };
    }
    const piece = this.board[move.from.r][move.from.c];
    if (!piece || piece.color !== this.turn) {
      return { ok: false, reason: "\u4E0D\u662F\u5F53\u524D\u65B9\u7684\u68CB\u5B50" };
    }
    const legal = getLegalMovesFrom(this.board, this.turn, move.from.r, move.from.c, {
      mode: this.mode
    });
    if (!legal.some((item) => item.to.r === move.to.r && item.to.c === move.to.c)) {
      return { ok: false, reason: "\u4E0D\u5408\u6CD5\u7684\u8D70\u6CD5" };
    }
    const mover = this.turn;
    const opponent = OPPOSITE[mover];
    const beforeAttacks = getAttackedEnemyIds(this.board, mover, {
      mode: this.mode
    });
    const simulated = applyMove(this.board, move);
    this.board = simulated.board;
    const afterAttacks = getAttackedEnemyIds(this.board, mover, {
      mode: this.mode
    });
    const chaseTargets = [...afterAttacks].filter((id) => !beforeAttacks.has(id));
    const kingCaptured = Boolean(
      simulated.captured && simulated.captured.kind === "K"
    );
    const gaveCheck = !kingCaptured && isInCheck(this.board, opponent, { mode: this.mode });
    this.lastMove = {
      from: { ...move.from },
      to: { ...move.to },
      mover,
      wasReveal: simulated.wasReveal,
      revealedKind: simulated.wasReveal ? simulated.piece.kind : null,
      capture: simulated.captured ? {
        color: simulated.captured.color,
        revealed: simulated.captured.revealed,
        kind: simulated.captured.kind
      } : null
    };
    this.history.push({
      move: {
        from: { ...move.from },
        to: { ...move.to }
      },
      mover,
      wasReveal: simulated.wasReveal,
      revealedKind: simulated.wasReveal ? simulated.piece.kind : null,
      captured: simulated.captured ? clonePiece(simulated.captured) : null,
      gaveCheck,
      chaseTargets
    });
    if (simulated.captured) {
      this.capturedBy[mover].push(simulated.captured);
    }
    if (simulated.wasReveal) {
      this.revealedCount += 1;
    }
    this.quietPlies = simulated.captured || simulated.wasReveal ? 0 : this.quietPlies + 1;
    if (kingCaptured) {
      this.winner = mover;
      this.status = "kingcaptured";
      this.turn = OPPOSITE[mover];
      this.inCheck = false;
      this.recordPosition();
      this.snapshots.push(this.createSnapshot());
      return { ok: true, mover, ...this.lastMove };
    }
    this.turn = OPPOSITE[mover];
    this.recordPosition();
    this.refreshStatus();
    this.snapshots.push(this.createSnapshot());
    return { ok: true, mover, ...this.lastMove };
  }
};

// src/engine/ai.js
var AI_DIFFICULTIES = {
  normal: { label: "\u4E00\u822C", depth: 2, timeLimit: 500 },
  medium: { label: "\u4E2D\u7B49", depth: 3, timeLimit: 1500 },
  hard: { label: "\u56F0\u96BE", depth: 4, timeLimit: 3500 }
};
var VALUES = { K: 1e4, R: 9, C: 4.5, H: 4, E: 2, A: 2, P: 1 };
var HIDDEN_VALUE = 3.2;
var MATE = 1e5;
var SEARCH_TIMEOUT = /* @__PURE__ */ Symbol("search-timeout");
var REPEAT_PENALTY = 0.8;
function inspectRepetition(game, move, color, rules) {
  const next = applyMove(game.board, move).board;
  const nextTurn = OPPOSITE[color];
  const plies = game.positionCounts.get(game.positionKey(next, nextTurn)) || [];
  const gaveCheck = isInCheck(next, nextTurn, rules);
  let losing = false;
  if (plies.length >= 1) {
    const segment = game.history.slice(plies[0]).map((entry) => ({
      mover: entry.mover,
      gaveCheck: entry.gaveCheck,
      chaseTargets: entry.chaseTargets
    }));
    segment.push({ mover: color, gaveCheck, chaseTargets: [] });
    losing = judgeRepetition(segment).loser === color;
  }
  return { repeats: plies.length, losing };
}
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
  return moves.slice().sort((a, b) => captureScore(board, b) - captureScore(board, a));
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
      deadline
    );
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function sameMove(a, b) {
  return a.from.r === b.from.r && a.from.c === b.from.c && a.to.r === b.to.r && a.to.c === b.to.c;
}
function chooseMove(game, color, options = {}) {
  const maxDepth = options.depth ?? 2;
  const timeLimit = options.timeLimit ?? Infinity;
  const deadline = Number.isFinite(timeLimit) ? Date.now() + timeLimit : Infinity;
  const rng = options.rng ?? Math.random;
  const rules = { mode: game.mode ?? "jieqi" };
  const board = game.board;
  let rootMoves = orderMoves(board, getLegalMoves(board, color, rules));
  if (rootMoves.length === 0) return null;
  const repetition = /* @__PURE__ */ new Map();
  for (const move of rootMoves) {
    repetition.set(move, inspectRepetition(game, move, color, rules));
  }
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
        const score = -search(
          next,
          OPPOSITE[color],
          depth - 1,
          -Infinity,
          -alpha,
          color,
          rules,
          deadline
        ) - penalty;
        scored.push({ move, score });
        if (score > alpha) alpha = score;
      }
      const bestScore = Math.max(...scored.map((item) => item.score));
      const pool = scored.filter((item) => item.score >= bestScore - 1e-3);
      bestMove = pool[Math.floor(rng() * pool.length)].move;
      rootMoves = [
        bestMove,
        ...rootMoves.filter((move) => !sameMove(move, bestMove))
      ];
      if (Date.now() >= deadline) break;
    }
  } catch (error) {
    if (error !== SEARCH_TIMEOUT) throw error;
  }
  return bestMove;
}

// src/ui/board.js
var BASE_W = 560;
var BASE_H = 620;
var PAD = 40;
var CELL = 60;
var RADIUS = 24;
var COLORS = {
  paper: "#f4efe5",
  board: "#e8c88a",
  boardEdge: "#a9773a",
  line: "#916233",
  river: "rgba(90, 55, 20, 0.55)",
  red: "#a62b23",
  black: "#2e3440",
  redDark: "#7c1f19",
  blackDark: "#20252e",
  pieceFace: "#f8edd2",
  select: "#d97706",
  move: "rgba(22, 120, 80, 0.55)",
  capture: "rgba(190, 55, 40, 0.78)",
  last: "rgba(217, 119, 6, 0.16)",
  check: "#d33a2c"
};
function point(r, c) {
  return { x: PAD + c * CELL, y: PAD + r * CELL };
}
function hitTestPoint(x, y) {
  const c = Math.round((x - PAD) / CELL);
  const r = Math.round((y - PAD) / CELL);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  const center = point(r, c);
  if (Math.hypot(x - center.x, y - center.y) > 30) return null;
  return { r, c };
}
function drawBoard(ctx, game, view) {
  drawBackground(ctx);
  drawGrid(ctx);
  drawLastMove(ctx, game);
  drawCheck(ctx, game);
  drawPieces(ctx, game, view);
  drawSelection(ctx, game, view);
}
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawBackground(ctx) {
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, BASE_W, BASE_H);
  roundedRect(ctx, PAD - 18, PAD - 18, 8 * CELL + 36, 9 * CELL + 36, 14);
  ctx.fillStyle = COLORS.board;
  ctx.fill();
  ctx.strokeStyle = COLORS.boardEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
}
function drawGrid(ctx) {
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let r = 0; r < ROWS; r++) {
    const y = PAD + r * CELL;
    ctx.moveTo(PAD, y);
    ctx.lineTo(PAD + 8 * CELL, y);
  }
  for (let c = 0; c < COLS; c++) {
    const x = PAD + c * CELL;
    if (c === 0 || c === COLS - 1) {
      ctx.moveTo(x, PAD);
      ctx.lineTo(x, PAD + 9 * CELL);
    } else {
      ctx.moveTo(x, PAD);
      ctx.lineTo(x, PAD + 4 * CELL);
      ctx.moveTo(x, PAD + 5 * CELL);
      ctx.lineTo(x, PAD + 9 * CELL);
    }
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(...corner(0, 3));
  ctx.lineTo(...corner(2, 5));
  ctx.moveTo(...corner(0, 5));
  ctx.lineTo(...corner(2, 3));
  ctx.moveTo(...corner(7, 3));
  ctx.lineTo(...corner(9, 5));
  ctx.moveTo(...corner(7, 5));
  ctx.lineTo(...corner(9, 3));
  ctx.stroke();
  ctx.fillStyle = COLORS.river;
  ctx.font = '22px "Songti SC", "Noto Serif SC", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u695A \u6CB3", PAD + 2 * CELL, PAD + 4.5 * CELL);
  ctx.fillText("\u6C49 \u754C", PAD + 6 * CELL, PAD + 4.5 * CELL);
}
function corner(r, c) {
  return [PAD + c * CELL, PAD + r * CELL];
}
function drawLastMove(ctx, game) {
  if (!game.lastMove) return;
  ctx.fillStyle = COLORS.last;
  for (const pos of [game.lastMove.from, game.lastMove.to]) {
    const p = point(pos.r, pos.c);
    ctx.beginPath();
    ctx.arc(p.x, p.y, RADIUS + 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawCheck(ctx, game) {
  if (!game.inCheck) return;
  const king = findKing(game.board, game.turn);
  if (!king) return;
  const p = point(king.r, king.c);
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, RADIUS + 7, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.check;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.restore();
}
function sideColor(color) {
  return color === RED ? COLORS.red : COLORS.black;
}
function drawPieces(ctx, game, view) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = game.board[r][c];
      if (!piece) continue;
      const p = point(r, c);
      if (piece.revealed) {
        drawRevealed(ctx, p, piece);
      } else {
        drawHidden(ctx, p, piece, view.debug);
      }
    }
  }
}
function drawRevealed(ctx, p, piece) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.pieceFace;
  ctx.fill();
  ctx.strokeStyle = sideColor(piece.color);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y, RADIUS - 5, 0, Math.PI * 2);
  ctx.strokeStyle = sideColor(piece.color);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = sideColor(piece.color);
  ctx.font = 'bold 25px "Songti SC", "Noto Serif SC", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(KIND_LABEL[piece.color][piece.kind], p.x, p.y + 1);
}
function drawHidden(ctx, p, piece, debug) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = piece.color === RED ? COLORS.redDark : COLORS.blackDark;
  ctx.fill();
  ctx.strokeStyle = COLORS.pieceFace;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y, RADIUS - 5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(248, 237, 210, 0.32)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (debug) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.font = 'bold 22px "Songti SC", "Noto Serif SC", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(KIND_LABEL[piece.color][piece.kind], p.x, p.y + 1);
    ctx.beginPath();
    ctx.arc(p.x, p.y, RADIUS - 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 214, 120, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }
  ctx.strokeStyle = "rgba(248, 237, 210, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(p.x - 9, p.y);
  ctx.lineTo(p.x, p.y - 9);
  ctx.lineTo(p.x + 9, p.y);
  ctx.lineTo(p.x, p.y + 9);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(248, 237, 210, 0.6)";
  ctx.fill();
}
function drawSelection(ctx, game, view) {
  if (!view.selected) return;
  const selected = point(view.selected.r, view.selected.c);
  ctx.beginPath();
  ctx.arc(selected.x, selected.y, RADIUS + 3, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.select;
  ctx.lineWidth = 4;
  ctx.stroke();
  for (const move of view.legal) {
    const target = point(move.to.r, move.to.c);
    const occupied = game.board[move.to.r][move.to.c];
    if (occupied) {
      ctx.beginPath();
      ctx.arc(target.x, target.y, RADIUS + 3, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.capture;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(target.x, target.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.move;
      ctx.fill();
    }
  }
}

// src/storage.js
var STORAGE_KEY = "xiangqi.local-match.v1";
var SAVE_VERSION = 1;
var MAX_PLIES = 2e3;
function requireValid(condition, message) {
  if (!condition) throw new Error(message || "\u5B58\u6863\u683C\u5F0F\u65E0\u6548");
}
function validPoint(point2) {
  return point2 && Number.isInteger(point2.r) && Number.isInteger(point2.c) && inside(point2.r, point2.c);
}
function validateInitial(initial, mode) {
  requireValid(initial && Array.isArray(initial.board), "\u5B58\u6863\u7F3A\u5C11\u5F00\u5C40\u68CB\u76D8");
  requireValid(initial.board.length === ROWS, "\u5B58\u6863\u68CB\u76D8\u884C\u6570\u65E0\u6548");
  requireValid(initial.turn === RED, "\u5B58\u6863\u5F00\u5C40\u56DE\u5408\u65E0\u6548");
  requireValid(initial.status === "playing", "\u5B58\u6863\u5F00\u5C40\u72B6\u6001\u65E0\u6548");
  requireValid(initial.winner === null && initial.drawReason === null, "\u5B58\u6863\u5F00\u5C40\u80DC\u8D1F\u72B6\u6001\u65E0\u6548");
  requireValid(initial.quietPlies === 0 && initial.revealedCount === 0, "\u5B58\u6863\u5F00\u5C40\u8BA1\u6570\u65E0\u6548");
  requireValid(initial.lastMove === null && initial.inCheck === false, "\u5B58\u6863\u5F00\u5C40\u8D70\u5B50\u72B6\u6001\u65E0\u6548");
  requireValid(
    initial.capturedBy && Array.isArray(initial.capturedBy.red) && Array.isArray(initial.capturedBy.black) && initial.capturedBy.red.length === 0 && initial.capturedBy.black.length === 0,
    "\u5B58\u6863\u5F00\u5C40\u5403\u5B50\u680F\u65E0\u6548"
  );
  const ids = /* @__PURE__ */ new Set();
  const kings = { red: 0, black: 0 };
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    requireValid(Array.isArray(initial.board[r]) && initial.board[r].length === COLS, "\u5B58\u6863\u68CB\u76D8\u5217\u6570\u65E0\u6548");
    for (let c = 0; c < COLS; c++) {
      const piece = initial.board[r][c];
      const homeRole = HOME_LAYOUT[r][c];
      if (!piece) {
        requireValid(!homeRole, "\u5B58\u6863\u5F00\u5C40\u7F3A\u5C11\u68CB\u5B50");
        continue;
      }
      requireValid(homeRole, "\u5B58\u6863\u5F00\u5C40\u6709\u591A\u4F59\u68CB\u5B50");
      const color = r >= 5 ? RED : BLACK;
      requireValid(piece.color === color, "\u5B58\u6863\u68CB\u5B50\u9635\u8425\u65E0\u6548");
      requireValid(KIND_LABEL[color][piece.kind], "\u5B58\u6863\u68CB\u5B50\u5175\u79CD\u65E0\u6548");
      requireValid(piece.homeRole === homeRole, "\u5B58\u6863\u68CB\u5B50\u539F\u4F4D\u89D2\u8272\u65E0\u6548");
      requireValid(typeof piece.revealed === "boolean", "\u5B58\u6863\u68CB\u5B50\u660E\u6697\u72B6\u6001\u65E0\u6548");
      requireValid(Number.isInteger(piece.id) && piece.id > 0 && !ids.has(piece.id), "\u5B58\u6863\u68CB\u5B50 ID \u65E0\u6548\u6216\u91CD\u590D");
      ids.add(piece.id);
      count += 1;
      if (piece.kind === "K") kings[color] += 1;
      if (mode === "standard") {
        requireValid(piece.revealed && piece.kind === homeRole, "\u5E38\u89C4\u8C61\u68CB\u5B58\u6863\u5E94\u4E3A\u7ECF\u5178\u660E\u5B50\u5E03\u5C40");
      } else {
        requireValid(piece.kind === "K" ? piece.revealed : !piece.revealed, "\u63ED\u68CB\u5B58\u6863\u5F00\u5C40\u660E\u6697\u72B6\u6001\u65E0\u6548");
      }
    }
  }
  requireValid(count === 32 && kings.red === 1 && kings.black === 1, "\u5B58\u6863\u5F00\u5C40\u68CB\u5B50\u6570\u91CF\u6216\u5C06\u5E05\u65E0\u6548");
}
function validatePayload(data) {
  requireValid(data && data.version === SAVE_VERSION, "\u5B58\u6863\u7248\u672C\u4E0D\u517C\u5BB9");
  requireValid(data.settings && typeof data.settings.aiEnabled === "boolean", "\u5B58\u6863\u4EBA\u673A\u8BBE\u7F6E\u65E0\u6548");
  requireValid(AI_DIFFICULTIES[data.settings.difficulty], "\u5B58\u6863\u96BE\u5EA6\u65E0\u6548");
  const archive = data.game;
  requireValid(archive && ["jieqi", "standard"].includes(archive.mode), "\u5B58\u6863\u6A21\u5F0F\u65E0\u6548");
  requireValid(Number.isInteger(archive.quietLimit) && archive.quietLimit > 0, "\u5B58\u6863\u548C\u68CB\u6B65\u6570\u8BBE\u7F6E\u65E0\u6548");
  validateInitial(archive.initial, archive.mode);
  requireValid(Array.isArray(archive.moves) && archive.moves.length <= MAX_PLIES, "\u5B58\u6863\u8D70\u5B50\u8BB0\u5F55\u65E0\u6548\u6216\u8FC7\u957F");
  for (const move of archive.moves) {
    requireValid(move && validPoint(move.from) && validPoint(move.to), "\u5B58\u6863\u8D70\u5B50\u5750\u6807\u65E0\u6548");
  }
  return {
    game: JieqiGame.fromArchive(archive),
    aiEnabled: data.settings.aiEnabled,
    difficulty: data.settings.difficulty,
    savedAt: data.savedAt
  };
}
function loadMatch(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const raw = target.getItem(STORAGE_KEY);
    if (raw === null) return { status: "empty" };
    return { status: "ok", match: validatePayload(JSON.parse(raw)) };
  } catch (error) {
    return { status: "error", message: error.message || "\u5B58\u6863\u8BFB\u53D6\u5931\u8D25" };
  }
}
function saveMatch(match, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const data = {
      version: SAVE_VERSION,
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      settings: {
        aiEnabled: match.aiEnabled,
        difficulty: match.difficulty
      },
      game: match.game.toArchive()
    };
    target.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true, savedAt: data.savedAt };
  } catch (error) {
    return { ok: false, message: error.message || "\u5B58\u6863\u5199\u5165\u5931\u8D25" };
  }
}
function clearMatch(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    target.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message || "\u5B58\u6863\u6E05\u9664\u5931\u8D25" };
  }
}
