// 小游戏主逻辑：菜单 / 对局 / 人机 / 存档 / 画布 UI
const XQ = require("./bundle.js");

const {
  JieqiGame,
  RED,
  BLACK,
  AI_DIFFICULTIES,
  chooseMove,
  drawBoard,
  hitTestPoint,
  BASE_W,
  BASE_H,
  loadMatch,
  saveMatch,
} = XQ;

const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
const W = info.windowWidth;
const H = info.windowHeight;
const DPR = info.pixelRatio || 2;

const canvas = wx.createCanvas();
canvas.width = Math.round(W * DPR);
canvas.height = Math.round(H * DPR);
const ctx = canvas.getContext("2d");

const STATUS_H = 44;
const BAR_H = 92;
const PAPER = "#f4efe5";
const INK = "#4a3a28";
const ACCENT = "#a62b23";
const LINE = "#d9c39d";

const DIFF_ORDER = ["normal", "medium", "hard"];

const state = {
  screen: "menu",
  game: null,
  mode: "jieqi",
  difficulty: "normal",
  selected: null,
  legal: [],
  aiThinking: false,
  hasSave: false,
};

let hitAreas = [];
let boardRect = { x: 0, y: 0, w: 0, h: 0, k: 1 };

const storage = {
  getItem(key) {
    const value = wx.getStorageSync(key);
    return value === "" || value === undefined || value === null ? null : value;
  },
  setItem(key, value) {
    wx.setStorageSync(key, value);
  },
  removeItem(key) {
    wx.removeStorageSync(key);
  },
};

/* ---------- 基础绘制 ---------- */

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawButton(x, y, w, h, label, action, active = false) {
  hitAreas.push({ x, y, w, h, action });

  ctx.save();
  roundedRect(x, y, w, h, 12);
  ctx.fillStyle = active ? ACCENT : "#fffdf7";
  ctx.fill();
  ctx.strokeStyle = active ? ACCENT : LINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = active ? "#fffdf7" : INK;
  ctx.font = "600 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

/* ---------- 状态文案 ---------- */

const WIN_REASON = {
  checkmate: "将死",
  stalemate: "困毙",
  kingcaptured: "将帅被擒",
  perpetualcheck: "长将判负",
  perpetualchase: "长捉判负",
};

function statusText() {
  const game = state.game;
  if (!game) return "";
  if (game.status === "draw") {
    return game.drawReason === "quiet" ? "和棋 · 步数已尽" : "和棋 · 三次重复";
  }
  if (game.status !== "playing") {
    const winner = game.winner === RED ? "红方" : "黑方";
    return `${winner}胜 · ${WIN_REASON[game.status] || ""}`;
  }
  if (state.aiThinking) return "黑方思考中…";
  const side = game.turn === RED ? "红方" : "黑方";
  return game.inCheck ? `${side}走棋 · 被将军` : `${side}走棋`;
}

/* ---------- 渲染 ---------- */

function render() {
  hitAreas = [];

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  if (state.screen === "menu") {
    renderMenu();
  } else {
    renderGame();
  }
}

function renderMenu() {
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 44px serif";
  ctx.fillText("象 棋", W / 2, H * 0.26);

  ctx.fillStyle = "#8a7458";
  ctx.font = "400 14px sans-serif";
  ctx.fillText("揭棋 · 单机练习", W / 2, H * 0.26 + 40);

  const bw = Math.min(W - 80, 300);
  const bx = (W - bw) / 2;
  let by = H * 0.45;

  drawButton(bx, by, bw, 54, "揭棋（暗子）", () => startGame("jieqi"));
  by += 72;
  drawButton(bx, by, bw, 54, "常规象棋", () => startGame("standard"));
  by += 72;

  if (state.hasSave) {
    drawButton(bx, by, bw, 46, "继续上局", resumeSaved);
  }

  ctx.fillStyle = "#a8977d";
  ctx.font = "400 12px sans-serif";
  ctx.fillText("v0.1 · 骨架版", W / 2, H - 34);
}

function renderGame() {
  const game = state.game;

  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, W, STATUS_H);
  ctx.strokeStyle = "#e7dcc7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, STATUS_H + 0.5);
  ctx.lineTo(W, STATUS_H + 0.5);
  ctx.stroke();

  ctx.fillStyle = game.status === "playing" ? INK : ACCENT;
  ctx.font = "600 15px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(statusText(), W / 2, STATUS_H / 2);

  const availH = H - STATUS_H - BAR_H;
  const k = Math.min(W / BASE_W, availH / BASE_H);
  const bw = BASE_W * k;
  const bh = BASE_H * k;
  const bx = (W - bw) / 2;
  const by = STATUS_H + (availH - bh) / 2;
  boardRect = { x: bx, y: by, w: bw, h: bh, k };

  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(k, k);
  drawBoard(ctx, game, {
    selected: state.selected,
    legal: state.legal,
    debug: false,
  });
  ctx.restore();

  renderBar();

  if (game.status !== "playing") {
    renderVictory(game);
  }
}

function renderBar() {
  const pad = 10;
  const gap = 8;
  const btns = [
    { label: "新局", action: () => startGame(state.mode) },
    {
      label: state.mode === "jieqi" ? "揭棋" : "常规",
      action: () => startGame(state.mode === "jieqi" ? "standard" : "jieqi"),
    },
    {
      label: `难度·${AI_DIFFICULTIES[state.difficulty].label}`,
      action: cycleDifficulty,
    },
    { label: "悔棋", action: undo },
  ];

  const bw = (W - pad * 2 - gap * 3) / 4;
  const bh = 52;
  const by = H - BAR_H + (BAR_H - bh) / 2;

  btns.forEach((btn, index) => {
    drawButton(pad + index * (bw + gap), by, bw, bh, btn.label, btn.action);
  });
}

function renderVictory(game) {
  const r = boardRect;

  ctx.save();
  ctx.fillStyle = "rgba(43, 33, 23, 0.45)";
  ctx.fillRect(r.x, r.y, r.w, r.h);

  const cw = Math.min(r.w * 0.78, 280);
  const ch = 176;
  const cx = r.x + (r.w - cw) / 2;
  const cy = r.y + (r.h - ch) / 2;

  roundedRect(cx, cy, cw, ch, 18);
  ctx.fillStyle = "rgba(255, 252, 245, 0.98)";
  ctx.fill();
  ctx.strokeStyle = "#c8a15c";
  ctx.lineWidth = 2;
  ctx.stroke();

  const redWins = game.winner === RED;
  const title = game.status === "draw" ? "和 棋" : `${redWins ? "红方" : "黑方"}胜`;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#b07a33";
  ctx.font = "600 12px sans-serif";
  ctx.fillText(
    game.status === "draw" ? "平 局" : game.status === "checkmate" ? "绝 杀" : "胜 局",
    cx + cw / 2,
    cy + 36,
  );

  ctx.fillStyle = game.status === "draw" ? INK : redWins ? ACCENT : "#2e3440";
  ctx.font = "700 40px serif";
  ctx.fillText(title, cx + cw / 2, cy + 78);

  ctx.fillStyle = "#8a7458";
  ctx.font = "400 13px sans-serif";
  ctx.fillText(WIN_REASON[game.status] || "", cx + cw / 2, cy + 110);

  const bw = cw - 64;
  drawButton(cx + 32, cy + ch - 50, bw, 38, "再来一局", () => startGame(state.mode), true);

  ctx.restore();
}

/* ---------- 逻辑 ---------- */

function saveNow() {
  if (!state.game) return;
  saveMatch(
    { game: state.game, aiEnabled: true, difficulty: state.difficulty },
    storage,
  );
}

function startGame(mode) {
  state.mode = mode;
  state.game = new JieqiGame({ mode });
  state.screen = "game";
  state.selected = null;
  state.legal = [];
  state.aiThinking = false;
  state.hasSave = true;
  saveNow();
  render();
}

function resumeSaved() {
  const result = loadMatch(storage);
  if (result.status !== "ok") {
    state.hasSave = false;
    render();
    return;
  }
  state.game = result.match.game;
  state.mode = result.match.game.mode;
  state.difficulty = result.match.difficulty;
  state.screen = "game";
  state.selected = null;
  state.legal = [];
  render();
}

function cycleDifficulty() {
  const index = DIFF_ORDER.indexOf(state.difficulty);
  state.difficulty = DIFF_ORDER[(index + 1) % DIFF_ORDER.length];
  saveNow();
  render();
}

function undo() {
  const game = state.game;
  if (!game || game.history.length === 0) return;

  let target = game.history.length - 1;
  while (target > 0 && game.snapshotAt(target).turn !== RED) {
    target -= 1;
  }
  if (!game.undoTo(target)) return;

  state.selected = null;
  state.legal = [];
  state.aiThinking = false;
  saveNow();
  render();
}

function afterMove() {
  const game = state.game;

  if (game.status !== "playing") {
    state.selected = null;
    state.legal = [];
    saveNow();
    render();
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: "heavy" });
    }
    return;
  }

  saveNow();
  render();
  maybeAi();
}

function maybeAi() {
  const game = state.game;
  if (!game || game.status !== "playing" || game.turn !== BLACK) return;

  state.aiThinking = true;
  render();

  setTimeout(() => {
    const current = state.game;
    if (!current || current.status !== "playing" || current.turn !== BLACK) {
      state.aiThinking = false;
      render();
      return;
    }

    const level = AI_DIFFICULTIES[state.difficulty];
    const move = chooseMove(current, BLACK, {
      depth: level.depth,
      timeLimit: Math.min(level.timeLimit, 1200),
    });

    state.aiThinking = false;
    if (move) current.play(move);
    afterMove();
  }, 220);
}

function handleCell(cell) {
  const game = state.game;

  if (state.selected) {
    const matched = state.legal.some(
      (move) => move.to.r === cell.r && move.to.c === cell.c,
    );
    if (matched) {
      const result = game.play({ from: { ...state.selected }, to: { ...cell } });
      state.selected = null;
      state.legal = [];
      if (result.ok) {
        afterMove();
        return;
      }
    }
  }

  const piece = game.board[cell.r][cell.c];
  if (piece && piece.color === RED && game.turn === RED) {
    state.selected = cell;
    state.legal = game.getLegalMovesFrom(cell.r, cell.c);
  } else {
    state.selected = null;
    state.legal = [];
  }
  render();
}

/* ---------- 输入 ---------- */

wx.onTouchStart((event) => {
  const touch = event.touches && event.touches[0];
  if (!touch) return;

  const x = touch.clientX;
  const y = touch.clientY;

  for (let i = hitAreas.length - 1; i >= 0; i -= 1) {
    const area = hitAreas[i];
    if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
      area.action();
      return;
    }
  }

  if (state.screen !== "game" || !state.game) return;
  if (state.game.status !== "playing" || state.aiThinking) return;
  if (state.game.turn !== RED) return;

  const r = boardRect;
  if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) return;

  const cell = hitTestPoint((x - r.x) / r.k, (y - r.y) / r.k);
  if (!cell) return;

  handleCell(cell);
});

/* ---------- 启动 ---------- */

(function boot() {
  const saved = loadMatch(storage);
  state.hasSave = saved.status === "ok" && saved.match.game.status === "playing";
  render();
})();
