import {
  ROWS,
  COLS,
  RED,
  BLACK,
  HOME_LAYOUT,
  KIND_LABEL,
  inside,
} from "./engine/core.js";
import { JieqiGame } from "./engine/game.js";
import { AI_DIFFICULTIES } from "./engine/ai.js";

export const STORAGE_KEY = "xiangqi.local-match.v1";
const SAVE_VERSION = 1;
const MAX_PLIES = 2000;

function requireValid(condition, message) {
  if (!condition) throw new Error(message || "存档格式无效");
}

function validPoint(point) {
  return (
    point &&
    Number.isInteger(point.r) &&
    Number.isInteger(point.c) &&
    inside(point.r, point.c)
  );
}

function validateInitial(initial, mode) {
  requireValid(initial && Array.isArray(initial.board), "存档缺少开局棋盘");
  requireValid(initial.board.length === ROWS, "存档棋盘行数无效");
  requireValid(initial.turn === RED, "存档开局回合无效");
  requireValid(initial.status === "playing", "存档开局状态无效");
  requireValid(initial.winner === null && initial.drawReason === null, "存档开局胜负状态无效");
  requireValid(initial.quietPlies === 0 && initial.revealedCount === 0, "存档开局计数无效");
  requireValid(initial.lastMove === null && initial.inCheck === false, "存档开局走子状态无效");
  requireValid(
    initial.capturedBy &&
      Array.isArray(initial.capturedBy.red) &&
      Array.isArray(initial.capturedBy.black) &&
      initial.capturedBy.red.length === 0 &&
      initial.capturedBy.black.length === 0,
    "存档开局吃子栏无效",
  );

  const ids = new Set();
  const kings = { red: 0, black: 0 };
  let count = 0;

  for (let r = 0; r < ROWS; r++) {
    requireValid(Array.isArray(initial.board[r]) && initial.board[r].length === COLS, "存档棋盘列数无效");
    for (let c = 0; c < COLS; c++) {
      const piece = initial.board[r][c];
      const homeRole = HOME_LAYOUT[r][c];
      if (!piece) {
        requireValid(!homeRole, "存档开局缺少棋子");
        continue;
      }

      requireValid(homeRole, "存档开局有多余棋子");
      const color = r >= 5 ? RED : BLACK;
      requireValid(piece.color === color, "存档棋子阵营无效");
      requireValid(KIND_LABEL[color][piece.kind], "存档棋子兵种无效");
      requireValid(piece.homeRole === homeRole, "存档棋子原位角色无效");
      requireValid(typeof piece.revealed === "boolean", "存档棋子明暗状态无效");
      requireValid(Number.isInteger(piece.id) && piece.id > 0 && !ids.has(piece.id), "存档棋子 ID 无效或重复");
      ids.add(piece.id);
      count += 1;

      if (piece.kind === "K") kings[color] += 1;
      if (mode === "standard") {
        requireValid(piece.revealed && piece.kind === homeRole, "常规象棋存档应为经典明子布局");
      } else {
        requireValid(piece.kind === "K" ? piece.revealed : !piece.revealed, "揭棋存档开局明暗状态无效");
      }
    }
  }

  requireValid(count === 32 && kings.red === 1 && kings.black === 1, "存档开局棋子数量或将帅无效");
}

function validatePayload(data) {
  requireValid(data && data.version === SAVE_VERSION, "存档版本不兼容");
  requireValid(data.settings && typeof data.settings.aiEnabled === "boolean", "存档人机设置无效");
  requireValid(AI_DIFFICULTIES[data.settings.difficulty], "存档难度无效");

  const archive = data.game;
  requireValid(archive && ["jieqi", "standard"].includes(archive.mode), "存档模式无效");
  requireValid(Number.isInteger(archive.quietLimit) && archive.quietLimit > 0, "存档和棋步数设置无效");
  validateInitial(archive.initial, archive.mode);
  requireValid(Array.isArray(archive.moves) && archive.moves.length <= MAX_PLIES, "存档走子记录无效或过长");

  for (const move of archive.moves) {
    requireValid(move && validPoint(move.from) && validPoint(move.to), "存档走子坐标无效");
  }

  return {
    game: JieqiGame.fromArchive(archive),
    aiEnabled: data.settings.aiEnabled,
    difficulty: data.settings.difficulty,
    savedAt: data.savedAt,
  };
}

export function loadMatch(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const raw = target.getItem(STORAGE_KEY);
    if (raw === null) return { status: "empty" };
    return { status: "ok", match: validatePayload(JSON.parse(raw)) };
  } catch (error) {
    return { status: "error", message: error.message || "存档读取失败" };
  }
}

export function saveMatch(match, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const data = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      settings: {
        aiEnabled: match.aiEnabled,
        difficulty: match.difficulty,
      },
      game: match.game.toArchive(),
    };
    target.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true, savedAt: data.savedAt };
  } catch (error) {
    return { ok: false, message: error.message || "存档写入失败" };
  }
}

export function clearMatch(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    target.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message || "存档清除失败" };
  }
}
