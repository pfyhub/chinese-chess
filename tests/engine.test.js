import {
  ROWS,
  COLS,
  RED,
  BLACK,
  HOME_LAYOUT,
  emptyBoard,
  makePiece,
} from "../src/engine/core.js";
import { createBoard, createStandardBoard } from "../src/engine/setup.js";
import {
  applyMove,
  getLegalMoves,
  getPseudoMoves,
  isInCheck,
} from "../src/engine/moves.js";
import { JieqiGame } from "../src/engine/game.js";
import { judgeRepetition } from "../src/engine/repetition.js";
import { AI_DIFFICULTIES, chooseMove } from "../src/engine/ai.js";
import {
  STORAGE_KEY,
  clearMatch,
  loadMatch,
  saveMatch,
} from "../src/storage.js";

function boardWith(entries) {
  const board = emptyBoard();
  for (const [r, c, color, kind, revealed = true, homeRole = kind] of entries) {
    board[r][c] = makePiece(color, kind, homeRole, revealed);
  }
  return board;
}

function freshGame(entries) {
  const game = new JieqiGame();
  game.board = boardWith(entries);
  game.turn = RED;
  game.status = "playing";
  game.winner = null;
  game.quietPlies = 0;
  game.history = [];
  game.positionCounts = new Map();
  game.capturedBy = { red: [], black: [] };
  game.revealedCount = 0;
  game.recordPosition();
  game.inCheck = false;
  game.lastMove = null;
  game.drawReason = null;
  game.snapshots = [game.createSnapshot()];
  return game;
}

function hasDest(moves, r, c) {
  return moves.some((move) => move.r === r && move.c === c);
}

function hasMove(moves, fr, fc, tr, tc) {
  return moves.some(
    (move) =>
      move.from.r === fr &&
      move.from.c === fc &&
      move.to.r === tr &&
      move.to.c === tc,
  );
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "断言失败");
}

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, message || "应抛出错误");
}

function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || "值不相等"}：期望 ${expected}，实际 ${actual}`);
  }
}

export function runTests(listEl, summaryEl) {
  listEl.replaceChildren();

  const tests = [];
  const test = (name, fn) => tests.push({ name, fn });

  test("开局 32 枚棋子、双方各 15 枚暗子", () => {
    const board = createBoard(() => 0.42);
    let total = 0;
    let hiddenRed = 0;
    let hiddenBlack = 0;
    const counts = { red: {}, black: {} };

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        total += 1;
        if (!piece.revealed) {
          if (piece.color === RED) hiddenRed += 1;
          else hiddenBlack += 1;
          counts[piece.color][piece.kind] =
            (counts[piece.color][piece.kind] || 0) + 1;
          equal(
            piece.homeRole,
            HOME_LAYOUT[r][c],
            `暗子在 (${r},${c}) 的原位角色`,
          );
        }
      }
    }

    equal(total, 32, "棋子总数");
    equal(hiddenRed, 15, "红方暗子数");
    equal(hiddenBlack, 15, "黑方暗子数");
    equal(board[0][4].kind, "K", "黑将位置");
    equal(board[9][4].kind, "K", "红帅位置");
    equal(board[0][4].revealed, true, "黑将明置");
    equal(board[9][4].revealed, true, "红帅明置");

    for (const side of [RED, BLACK]) {
      equal(counts[side].R, 2, `${side} 车数量`);
      equal(counts[side].H, 2, `${side} 马数量`);
      equal(counts[side].E, 2, `${side} 象数量`);
      equal(counts[side].A, 2, `${side} 士数量`);
      equal(counts[side].C, 2, `${side} 炮数量`);
      equal(counts[side].P, 5, `${side} 兵数量`);
    }
  });

  test("暗子按所在位置的角色行走（车位的暗子走车）", () => {
    const board = boardWith([[5, 4, RED, "P", false, "R"]]);
    const moves = getPseudoMoves(board, 5, 4);
    equal(moves.length, 17, "空盘上车位暗子的走法数");
    assert(hasDest(moves, 5, 8), "应能向右走到底");
    assert(hasDest(moves, 0, 4), "应能向上走到底");
  });

  test("暗马按马走，并且会蹩马腿", () => {
    const board = boardWith([
      [5, 4, RED, "R", false, "H"],
      [4, 4, BLACK, "P", true],
    ]);
    const moves = getPseudoMoves(board, 5, 4);
    assert(!hasDest(moves, 3, 3), "马腿被挡，不应走到 (3,3)");
    assert(!hasDest(moves, 3, 5), "马腿被挡，不应走到 (3,5)");
    assert(hasDest(moves, 4, 2), "应能走到 (4,2)");
    assert(hasDest(moves, 6, 2), "应能走到 (6,2)");
  });

  test("暗兵第一步只能向前", () => {
    const board = boardWith([[3, 0, BLACK, "R", false, "P"]]);
    const moves = getPseudoMoves(board, 3, 0);
    equal(moves.length, 1, "暗兵走法数");
    assert(hasDest(moves, 4, 0), "黑卒应向前走到 (4,0)");
  });

  test("翻开的兵过河后可以横走，不能后退", () => {
    const board = boardWith([[4, 4, RED, "P", true]]);
    const moves = getPseudoMoves(board, 4, 4);
    equal(moves.length, 3, "过河兵走法数");
    assert(hasDest(moves, 3, 4), "应能向前");
    assert(hasDest(moves, 4, 3), "应能向左");
    assert(hasDest(moves, 4, 5), "应能向右");
    assert(!hasDest(moves, 5, 4), "不能后退");
  });

  test("翻开的士可以离开九宫", () => {
    const board = boardWith([[5, 4, RED, "A", true]]);
    const moves = getPseudoMoves(board, 5, 4);
    equal(moves.length, 4, "士的走法数");
    assert(hasDest(moves, 4, 3), "应能走到 (4,3)");
    assert(hasDest(moves, 6, 5), "应能走到 (6,5)");
  });

  test("翻开的象可以过河", () => {
    const board = boardWith([[4, 4, RED, "E", true]]);
    const moves = getPseudoMoves(board, 4, 4);
    equal(moves.length, 4, "象的走法数");
    assert(hasDest(moves, 2, 2), "应能过河到 (2,2)");
    assert(hasDest(moves, 6, 6), "应能回到己方半场 (6,6)");
  });

  test("炮必须隔一个棋子才能吃子", () => {
    const oneScreen = boardWith([
      [5, 0, RED, "C", true],
      [5, 2, BLACK, "P", true],
      [5, 4, BLACK, "R", true],
    ]);
    assert(
      hasDest(getPseudoMoves(oneScreen, 5, 0), 5, 4),
      "一个炮架时应能打子",
    );
    assert(
      hasDest(getPseudoMoves(oneScreen, 5, 0), 5, 1),
      "炮应能走到炮架前的空位",
    );

    const twoScreens = boardWith([
      [5, 0, RED, "C", true],
      [5, 2, BLACK, "P", true],
      [5, 3, BLACK, "P", true],
      [5, 4, BLACK, "R", true],
    ]);
    assert(
      !hasDest(getPseudoMoves(twoScreens, 5, 0), 5, 4),
      "两个炮架时不能打子",
    );
  });

  test("将帅照面的走法被禁止", () => {
    const board = boardWith([
      [9, 4, RED, "K", true],
      [0, 4, BLACK, "K", true],
      [5, 4, RED, "R", true],
    ]);
    const legal = getLegalMoves(board, RED);
    assert(
      !hasMove(legal, 5, 4, 5, 0),
      "移开挡子的车会让将帅照面，应被禁止",
    );
    assert(
      hasMove(legal, 5, 4, 4, 4),
      "仍在同一纵线挡住的走法应合法",
    );
  });

  test("被将军时，不能走与应将无关的棋", () => {
    const board = boardWith([
      [9, 4, RED, "K", true],
      [5, 4, BLACK, "R", true],
      [6, 0, RED, "P", true],
    ]);
    assert(isInCheck(board, RED), "红方应处于被将军状态");
    const legal = getLegalMoves(board, RED);
    assert(
      !hasMove(legal, 6, 0, 5, 0),
      "无关的兵步不能解除将军，应被禁止",
    );
    assert(hasMove(legal, 9, 4, 9, 3), "帅应能躲到 (9,3)");
    assert(
      !hasMove(legal, 9, 4, 8, 4),
      "帅仍在被攻击的纵线上，应被禁止",
    );
  });

  test("将死判定：无合法走法且被将军", () => {
    const board = boardWith([
      [0, 4, BLACK, "K", true],
      [1, 0, RED, "R", true],
      [1, 4, RED, "R", true],
      [0, 0, RED, "R", true],
      [0, 8, RED, "R", true],
      [9, 3, RED, "K", true],
    ]);
    assert(isInCheck(board, BLACK), "黑方应被将军");
    equal(getLegalMoves(board, BLACK).length, 0, "黑方合法走法数");
  });

  test("困毙判定：未被将军但无合法走法", () => {
    const board = boardWith([
      [0, 3, BLACK, "K", true],
      [0, 4, RED, "H", true],
      [0, 8, RED, "R", true],
      [1, 8, RED, "R", true],
      [9, 4, RED, "K", true],
    ]);
    assert(!isInCheck(board, BLACK), "黑方不应被将军");
    equal(getLegalMoves(board, BLACK).length, 0, "黑方合法走法数");
  });

  test("暗子走一步后自动翻开，颜色与身份保留", () => {
    const board = boardWith([[5, 4, RED, "P", false, "R"]]);
    const result = applyMove(board, {
      from: { r: 5, c: 4 },
      to: { r: 5, c: 8 },
    });
    assert(result.wasReveal, "应标记为翻子");
    assert(result.piece.revealed, "落子后应为明子");
    equal(result.piece.kind, "P", "翻出的真实身份");
    equal(result.board[5][8].kind, "P", "棋盘上的身份");
    equal(result.board[5][8].revealed, true, "棋盘上的明暗状态");
    equal(result.board[5][4], null, "起点应清空");
  });

  test("被吃暗子保留暗子标记并公开真实身份", () => {
    const game = freshGame([
      [9, 4, RED, "K", true],
      [0, 4, BLACK, "K", true],
      [5, 0, RED, "R", true],
      [5, 4, BLACK, "H", false],
    ]);

    const result = game.play({
      from: { r: 5, c: 0 },
      to: { r: 5, c: 4 },
    });

    assert(result.ok, "吃掉暗子应为合法走法");
    equal(result.capture.revealed, false, "吃子记录应保留暗子标记");
    equal(result.capture.kind, "H", "走子结果应公开被吃暗子的身份");
    equal(game.capturedBy.red[0].kind, "H", "吃子栏应能显示真实身份");
  });

  test("翻子后悔棋恢复暗子身份、ID 和计数", () => {
    const game = freshGame([
      [9, 5, RED, "K", true],
      [0, 4, BLACK, "K", true],
      [5, 4, RED, "P", false, "R"],
    ]);
    const pieceId = game.board[5][4].id;

    const result = game.play({
      from: { r: 5, c: 4 },
      to: { r: 5, c: 8 },
    });
    assert(result.ok, "暗子应能按车位走法翻开");
    equal(game.revealedCount, 1, "翻子计数应增加");
    assert(game.undoTo(0), "应能悔棋到开局");

    const restored = game.board[5][4];
    equal(restored.id, pieceId, "棋子 ID 应保持不变");
    equal(restored.kind, "P", "真实身份应保留");
    equal(restored.revealed, false, "棋子应恢复为暗子");
    equal(game.board[5][8], null, "终点应清空");
    equal(game.revealedCount, 0, "翻子计数应恢复");
    equal(game.history.length, 0, "历史应截断");
    equal(game.snapshots.length, 1, "未来快照应删除");
  });

  test("吃暗子后悔棋恢复棋子和吃子栏", () => {
    const game = freshGame([
      [9, 5, RED, "K", true],
      [0, 4, BLACK, "K", true],
      [5, 0, RED, "R", true],
      [5, 4, BLACK, "H", false],
    ]);
    const targetId = game.board[5][4].id;

    const result = game.play({
      from: { r: 5, c: 0 },
      to: { r: 5, c: 4 },
    });
    assert(result.ok, "吃暗子应合法");
    equal(game.capturedBy.red.length, 1, "吃子栏应增加");
    assert(game.undoTo(0), "应能撤销吃子");

    equal(game.board[5][0].kind, "R", "红车应回到起点");
    equal(game.board[5][4].id, targetId, "被吃棋子 ID 应恢复");
    equal(game.board[5][4].kind, "H", "被吃暗子的身份应恢复");
    equal(game.board[5][4].revealed, false, "被吃棋子应恢复暗置");
    equal(game.capturedBy.red.length, 0, "吃子栏应恢复为空");
  });

  test("连续走子后悔棋改走不保留未来分支", () => {
    const game = new JieqiGame({ mode: "standard" });
    assert(game.play({ from: { r: 6, c: 0 }, to: { r: 5, c: 0 } }).ok);
    assert(game.play({ from: { r: 3, c: 0 }, to: { r: 4, c: 0 } }).ok);
    assert(game.play({ from: { r: 6, c: 2 }, to: { r: 5, c: 2 } }).ok);

    assert(game.undoTo(1), "应能连续悔棋到第 1 手");
    equal(game.history.length, 1, "应只保留第 1 手");
    equal(game.snapshots.length, 2, "应只保留开局和第 1 手快照");
    equal(game.board[6][2].kind, "P", "被撤销的红兵应恢复");

    const branch = game.play({ from: { r: 3, c: 2 }, to: { r: 4, c: 2 } });
    assert(branch.ok, "悔棋后应能改走另一手");
    equal(game.history.length, 2, "新分支应追加到当前历史");
    for (const plies of game.positionCounts.values()) {
      assert(plies.every((ply) => ply <= game.history.length), "重复计数不应残留未来 ply");
    }
  });

  test("揭棋归档重放保留暗子、历史和快照", () => {
    const game = new JieqiGame({ rng: () => 0.42 });
    assert(game.play({ from: { r: 9, c: 0 }, to: { r: 8, c: 0 } }).ok);
    assert(game.play({ from: { r: 0, c: 0 }, to: { r: 1, c: 0 } }).ok);

    const archive = game.toArchive();
    const restored = JieqiGame.fromArchive(archive);
    equal(JSON.stringify(restored.toArchive()), JSON.stringify(archive), "归档往返数据应一致");
    equal(JSON.stringify(restored.board), JSON.stringify(game.board), "重放后棋盘及棋子 ID 应一致");
    equal(restored.revealedCount, 2, "重放后翻子数应一致");
    equal(restored.snapshots.length, 3, "重放应建立完整快照");
  });

  test("走子后轮换行棋方", () => {
    const game = new JieqiGame();
    game.board = boardWith([
      [9, 4, RED, "K", true],
      [0, 4, BLACK, "K", true],
      [5, 4, RED, "P", true],
      [5, 0, RED, "R", true],
    ]);
    game.turn = RED;
    game.status = "playing";
    game.quietPlies = 0;
    game.history = [];
    game.positionCounts = new Map();
    game.recordPosition();
    game.inCheck = false;
    game.snapshots = [game.createSnapshot()];

    const result = game.play({
      from: { r: 5, c: 0 },
      to: { r: 4, c: 0 },
    });

    assert(result.ok, "这一步应合法");
    equal(game.turn, BLACK, "应轮到黑方");
    equal(game.board[4][0].kind, "R", "红车应到达 (4,0)");
  });

  test("无吃子达到上限判和", () => {
    const game = new JieqiGame();
    game.board = boardWith([
      [9, 4, RED, "K", true],
      [0, 4, BLACK, "K", true],
      [5, 4, RED, "R", true],
    ]);
    game.turn = RED;
    game.status = "playing";
    game.quietPlies = 80;
    game.history = [];
    game.positionCounts = new Map();
    game.recordPosition();
    game.inCheck = false;
    game.snapshots = [game.createSnapshot()];

    game.refreshStatus();
    equal(game.status, "draw", "达到无吃子步数应判和");
  });

  test("重复局面裁决：长将判负、长捉判负、普通重复", () => {
    const perpetualCheck = [
      { mover: RED, gaveCheck: true, chaseTargets: [] },
      { mover: BLACK, gaveCheck: false, chaseTargets: [] },
      { mover: RED, gaveCheck: true, chaseTargets: [] },
      { mover: BLACK, gaveCheck: false, chaseTargets: [] },
    ];
    equal(
      judgeRepetition(perpetualCheck).reason,
      "perpetualcheck",
      "长将判定",
    );
    equal(judgeRepetition(perpetualCheck).loser, RED, "长将方");

    const perpetualChase = [
      { mover: RED, gaveCheck: false, chaseTargets: [7] },
      { mover: BLACK, gaveCheck: false, chaseTargets: [] },
      { mover: RED, gaveCheck: false, chaseTargets: [7] },
      { mover: BLACK, gaveCheck: false, chaseTargets: [] },
    ];
    equal(
      judgeRepetition(perpetualChase).reason,
      "perpetualchase",
      "长捉判定",
    );
    equal(judgeRepetition(perpetualChase).loser, RED, "长捉方");

    const plain = [
      { mover: RED, gaveCheck: false, chaseTargets: [] },
      { mover: BLACK, gaveCheck: false, chaseTargets: [] },
    ];
    equal(judgeRepetition(plain).loser, null, "普通重复不应判负");
  });

  test("长将判负：连续将军形成三次重复", () => {
    const game = freshGame([
      [9, 5, RED, "K", true],
      [0, 4, BLACK, "K", true],
      [1, 3, RED, "R", true],
    ]);

    const loop = [
      [{ r: 1, c: 3 }, { r: 1, c: 4 }],
      [{ r: 0, c: 4 }, { r: 0, c: 3 }],
      [{ r: 1, c: 4 }, { r: 1, c: 3 }],
      [{ r: 0, c: 3 }, { r: 0, c: 4 }],
    ];

    for (let round = 0; round < 2; round++) {
      for (const [from, to] of loop) {
        const result = game.play({ from, to });
        assert(
          result.ok,
          `走法应合法 (${from.r},${from.c})→(${to.r},${to.c})：${result.reason}`,
        );
      }
    }

    equal(game.status, "perpetualcheck", "应判长将");
    equal(game.winner, BLACK, "红方长将判负");

    const lastMove = game.history[game.history.length - 1].move;
    assert(game.undoTo(game.history.length - 1), "应能撤销长将终局前一手");
    equal(game.status, "playing", "悔棋后应恢复进行状态");
    const replayed = game.play(lastMove);
    assert(replayed.ok, "悔棋后应能重走同一手");
    equal(game.status, "perpetualcheck", "重走后应再次判长将");
  });

  test("长捉判负：连续追捉同一子形成三次重复", () => {
    const game = freshGame([
      [9, 5, RED, "K", true],
      [0, 4, BLACK, "K", true],
      [2, 0, RED, "R", true],
      [4, 4, BLACK, "H", true],
    ]);

    const loop = [
      [{ r: 2, c: 0 }, { r: 4, c: 0 }],
      [{ r: 4, c: 4 }, { r: 2, c: 3 }],
      [{ r: 4, c: 0 }, { r: 2, c: 0 }],
      [{ r: 2, c: 3 }, { r: 4, c: 4 }],
    ];

    for (let round = 0; round < 2; round++) {
      for (const [from, to] of loop) {
        const result = game.play({ from, to });
        assert(
          result.ok,
          `走法应合法 (${from.r},${from.c})→(${to.r},${to.c})：${result.reason}`,
        );
      }
    }

    equal(game.status, "perpetualchase", "应判长捉");
    equal(game.winner, BLACK, "红方长捉判负");
  });

  test("AI 会选择吃掉无保护的车", () => {
    const game = new JieqiGame();
    game.board = boardWith([
      [9, 5, RED, "K", true],
      [0, 4, BLACK, "K", true],
      [5, 4, RED, "R", true],
      [5, 0, BLACK, "R", true],
    ]);

    const move = chooseMove(game, BLACK, { depth: 2, rng: () => 0 });
    assert(move, "AI 应返回一步棋");
    equal(move.from.r, 5, "起点行");
    equal(move.from.c, 0, "起点列");
    equal(move.to.r, 5, "终点行");
    equal(move.to.c, 4, "终点列");
  });

  test("AI 在真实开局局面能给出合法走法", () => {
    const game = new JieqiGame();
    const start = performance.now();
    const move = chooseMove(game, BLACK, { depth: 2 });
    const elapsed = performance.now() - start;

    assert(move, "AI 应返回一步棋");
    const legal = getLegalMoves(game.board, BLACK);
    assert(
      legal.some(
        (item) =>
          item.from.r === move.from.r &&
          item.from.c === move.from.c &&
          item.to.r === move.to.r &&
          item.to.c === move.to.c,
      ),
      "AI 的走法应合法",
    );
    assert(elapsed < 5000, `AI 思考耗时过长：${Math.round(elapsed)}ms`);
  });

  test("常规象棋开局：32 枚明子、经典布局与 44 步合法着法", () => {
    const board = createStandardBoard();
    let total = 0;
    let hidden = 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        total += 1;
        if (!piece.revealed) hidden += 1;
        equal(piece.kind, HOME_LAYOUT[r][c], `(${r},${c}) 的棋子身份`);
        equal(piece.color, r >= 5 ? RED : BLACK, `(${r},${c}) 的棋子颜色`);
      }
    }

    equal(total, 32, "棋子总数");
    equal(hidden, 0, "常规模式不应有暗子");
    equal(board[0][0].kind, "R", "黑方角落的车");
    equal(board[9][4].kind, "K", "红帅位置");
    equal(
      getLegalMoves(board, RED, { mode: "standard" }).length,
      44,
      "常规开局合法走法数",
    );
  });

  test("常规象棋的士不能出九宫、象不能过河", () => {
    const advisorBoard = boardWith([[9, 3, RED, "A", true]]);
    const advisorMoves = getPseudoMoves(advisorBoard, 9, 3, {
      mode: "standard",
    });
    equal(advisorMoves.length, 1, "常规士的走法数");
    assert(hasDest(advisorMoves, 8, 4), "常规士只能斜走入九宫");

    const elephantBoard = boardWith([[4, 4, RED, "E", true]]);
    const elephantMoves = getPseudoMoves(elephantBoard, 4, 4, {
      mode: "standard",
    });
    equal(elephantMoves.length, 2, "过河位置的常规象只能返回己方半场");
    assert(hasDest(elephantMoves, 6, 2), "应能返回 (6,2)");
    assert(hasDest(elephantMoves, 6, 6), "应能返回 (6,6)");
    assert(!hasDest(elephantMoves, 2, 2), "不能继续过河到 (2,2)");
  });

  test("常规象棋模式可以走子并轮换回合", () => {
    const game = new JieqiGame({ mode: "standard" });
    const result = game.play({
      from: { r: 6, c: 0 },
      to: { r: 5, c: 0 },
    });

    assert(result.ok, "常规开局兵进一步应合法");
    equal(game.turn, BLACK, "应轮到黑方");
    equal(game.board[5][0].kind, "P", "红兵应到达 (5,0)");
    equal(game.revealedCount, 0, "常规模式不应产生翻子计数");
  });

  test("本地存档恢复常规对局和人机设置", () => {
    const storage = memoryStorage();
    const game = new JieqiGame({ mode: "standard" });
    assert(game.play({ from: { r: 6, c: 0 }, to: { r: 5, c: 0 } }).ok);

    const saved = saveMatch({ game, aiEnabled: false, difficulty: "hard" }, storage);
    assert(saved.ok, `存档应写入成功：${saved.message || ""}`);
    const loaded = loadMatch(storage);
    equal(loaded.status, "ok", "有效存档应读取成功");
    equal(loaded.match.game.mode, "standard", "应恢复常规模式");
    equal(loaded.match.game.history.length, 1, "应恢复走子历史");
    equal(JSON.stringify(loaded.match.game.board), JSON.stringify(game.board), "应恢复当前棋盘");
    equal(loaded.match.aiEnabled, false, "应恢复人机开关");
    equal(loaded.match.difficulty, "hard", "应恢复难度");
    assert(clearMatch(storage).ok, "应能清除存档");
    equal(loadMatch(storage).status, "empty", "清除后应无存档");
  });

  test("坏 JSON、错版本、重复 ID 和非法走法会拒绝存档", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "{");
    equal(loadMatch(storage).status, "error", "坏 JSON 应被拒绝");

    const game = new JieqiGame({ mode: "standard" });
    assert(saveMatch({ game, aiEnabled: true, difficulty: "normal" }, storage).ok);
    const valid = storage.getItem(STORAGE_KEY);
    const payload = JSON.parse(valid);

    payload.version = 99;
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    equal(loadMatch(storage).status, "error", "未知版本应被拒绝");

    payload.version = 1;
    payload.game.initial.board[0][0].id = payload.game.initial.board[0][1].id;
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    equal(loadMatch(storage).status, "error", "重复棋子 ID 应被拒绝");

    storage.setItem(STORAGE_KEY, valid);
    const illegal = JSON.parse(valid);
    illegal.game.moves = [{ from: { r: 0, c: 0 }, to: { r: 1, c: 0 } }];
    storage.setItem(STORAGE_KEY, JSON.stringify(illegal));
    equal(loadMatch(storage).status, "error", "非法走子应被拒绝");
  });

  test("终局后存在额外走法的归档会被拒绝", () => {
    const game = freshGame([
      [9, 5, RED, "K", true],
      [0, 4, BLACK, "K", true],
      [1, 4, RED, "R", true],
    ]);
    assert(game.play({ from: { r: 1, c: 4 }, to: { r: 0, c: 4 } }).ok);
    equal(game.status, "kingcaptured", "测试局面应吃将终局");

    const archive = game.toArchive();
    archive.moves.push({ from: { r: 0, c: 0 }, to: { r: 0, c: 1 } });
    assertThrows(() => JieqiGame.fromArchive(archive), "终局后的额外走法应被拒绝");
  });

  test("本地存储读写异常不会作为有效存档返回", () => {
    const storage = {
      getItem() {
        throw new Error("读取受限");
      },
      setItem() {
        throw new Error("配额不足");
      },
      removeItem() {
        throw new Error("清除受限");
      },
    };
    const game = new JieqiGame({ mode: "standard" });
    equal(loadMatch(storage).status, "error", "读取异常应被捕获");
    equal(saveMatch({ game, aiEnabled: true, difficulty: "normal" }, storage).ok, false, "写入异常应被捕获");
    equal(clearMatch(storage).ok, false, "清除异常应被捕获");
  });

  test("三档 AI 难度加深搜索，限时搜索仍能给出合法着法", () => {
    equal(AI_DIFFICULTIES.normal.depth, 2, "一般难度搜索深度");
    equal(AI_DIFFICULTIES.medium.depth, 3, "中等难度搜索深度");
    equal(AI_DIFFICULTIES.hard.depth, 4, "困难难度搜索深度");
    assert(
      AI_DIFFICULTIES.normal.timeLimit < AI_DIFFICULTIES.medium.timeLimit &&
        AI_DIFFICULTIES.medium.timeLimit < AI_DIFFICULTIES.hard.timeLimit,
      "难度越高，思考时间上限应越长",
    );

    const game = new JieqiGame({ mode: "standard" });
    const start = performance.now();
    const move = chooseMove(game, BLACK, {
      depth: AI_DIFFICULTIES.hard.depth,
      timeLimit: 80,
    });
    const elapsed = performance.now() - start;

    assert(move, "限时搜索也应返回一步棋");
    const legal = getLegalMoves(game.board, BLACK, { mode: "standard" });
    assert(
      legal.some(
        (item) =>
          item.from.r === move.from.r &&
          item.from.c === move.from.c &&
          item.to.r === move.to.r &&
          item.to.c === move.to.c,
      ),
      "常规模式下 AI 的走法应合法",
    );
    assert(elapsed < 1500, `限时搜索未及时返回：${Math.round(elapsed)}ms`);
  });

  let passed = 0;
  for (const { name, fn } of tests) {
    const item = document.createElement("li");
    try {
      fn();
      passed += 1;
      item.className = "pass";
      item.textContent = `✓ ${name}`;
    } catch (error) {
      item.className = "fail";
      item.textContent = `✗ ${name} — ${error.message}`;
    }
    listEl.appendChild(item);
  }

  summaryEl.textContent = `${passed} / ${tests.length} 通过`;
  summaryEl.className = passed === tests.length ? "ok" : "bad";
}
