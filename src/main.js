import { JieqiGame } from "./engine/game.js";
import { RED, BLACK, KIND_LABEL } from "./engine/core.js";
import { AI_DIFFICULTIES, chooseMove } from "./engine/ai.js";
import { hitTest, renderBoard } from "./ui/board.js";
import { loadMatch, saveMatch } from "./storage.js";

const AI_COLOR = BLACK;
const MODE_COPY = {
  jieqi: {
    title: "揭棋",
    subtitle: "暗子按原位走法行棋，落子后翻开",
    rules: [
      "除将帅外，双方各 15 枚暗子随机盖在原始位置。",
      "暗子第一步按所在位置的走法行走，走完翻开。",
      "翻开的士可出九宫，象可过河。",
      "暗子被吃后公开真实身份，并保留“暗”标记。",
      "将死或困毙判负；三次重复、80 步无吃子判和。",
      "连续将军不变着法判长将负，连续追捉同一子判长捉负。",
    ],
  },
  standard: {
    title: "常规象棋",
    subtitle: "经典明子布局，红方先行",
    rules: [
      "双方按经典象棋布局摆子，所有棋子均为明子。",
      "士只能留在九宫内斜走，象不能过河。",
      "兵卒过河后可横走，将帅不能照面。",
      "将死或困毙判负；三次重复、80 步无吃子判和。",
      "连续将军不变着法判长将负，连续追捉同一子判长捉负。",
    ],
  },
};

let game = new JieqiGame();
let currentDifficulty = "normal";
let selected = null;
let legal = [];
let debug = false;
let aiEnabled = true;
let aiThinking = false;
let aiToken = 0;
let aiTimer = null;
let reviewPly = null;
let hasActiveMatch = false;

const canvas = document.getElementById("board");
const els = {
  turnCard: document.getElementById("turn-card"),
  turnLabel: document.getElementById("turn-label"),
  turnSub: document.getElementById("turn-sub"),
  revealCount: document.getElementById("reveal-count"),
  revealStat: document.getElementById("reveal-stat"),
  quietCount: document.getElementById("quiet-count"),
  capturedRed: document.getElementById("captured-red"),
  capturedBlack: document.getElementById("captured-black"),
  newGame: document.getElementById("new-game"),
  changeMode: document.getElementById("change-mode"),
  undoMove: document.getElementById("undo-move"),
  debugToggle: document.getElementById("debug-toggle"),
  debugOption: document.getElementById("debug-option"),
  aiToggle: document.getElementById("ai-toggle"),
  difficulty: document.getElementById("difficulty"),
  startDifficulty: document.getElementById("start-difficulty"),
  startScreen: document.getElementById("start-screen"),
  startGame: document.getElementById("start-game"),
  continueGame: document.getElementById("continue-game"),
  startMessage: document.getElementById("start-message"),
  modeTitle: document.getElementById("mode-title"),
  modeSubtitle: document.getElementById("mode-subtitle"),
  rulesList: document.getElementById("rules-list"),
  message: document.getElementById("message"),
  reviewStatus: document.getElementById("review-status"),
  reviewStart: document.getElementById("review-start"),
  reviewPrev: document.getElementById("review-prev"),
  reviewNext: document.getElementById("review-next"),
  reviewCurrent: document.getElementById("review-current"),
  moveList: document.getElementById("move-list"),
  emptyNotation: document.getElementById("empty-notation"),
};

function clearSelection() {
  selected = null;
  legal = [];
}

function getStatus(state) {
  let status;

  if (state.status === "playing") {
    status = {
      title: state.turn === RED ? "红方走棋" : "黑方走棋",
      sub: aiThinking
        ? `AI（${AI_DIFFICULTIES[currentDifficulty].label}）思考中…`
        : state.inCheck
          ? "将军！必须应将"
          : "点选棋子查看可走位置",
      turn: state.turn,
    };
  } else if (state.status === "draw") {
    status = {
      title: "和棋",
      sub: state.drawReason === "quiet" ? "80 步无吃子" : "三次重复局面",
      turn: "draw",
    };
  } else {
    const winner = state.winner === RED ? "红方" : "黑方";
    const reason =
      {
        checkmate: "将死",
        stalemate: "困毙",
        kingcaptured: "吃将",
        perpetualcheck: "长将判负",
        perpetualchase: "长捉判负",
      }[state.status] || "";
    status = { title: `${winner}胜`, sub: reason, turn: state.winner };
  }

  if (reviewPly !== null) {
    status.sub = `第 ${reviewPly} / ${game.history.length} 手，棋盘已锁定`;
  }
  return status;
}

function renderCaptured(container, pieces) {
  container.replaceChildren();

  if (pieces.length === 0) {
    const empty = document.createElement("span");
    empty.className = "chip empty";
    empty.textContent = "—";
    container.appendChild(empty);
    return;
  }

  for (const piece of pieces) {
    const chip = document.createElement("span");
    const side = piece.color === RED ? "红" : "黑";
    chip.className = `chip ${piece.color}`;
    const kindLabel = KIND_LABEL[piece.color][piece.kind];
    if (piece.revealed) {
      chip.textContent = kindLabel;
    } else {
      chip.classList.add("hidden");
      chip.textContent = `${side}·暗·${kindLabel}`;
      chip.title = `${side}方暗子，被吃后揭示为「${kindLabel}」`;
    }
    container.appendChild(chip);
  }
}

function updatePanel(state) {
  const status = getStatus(state);
  els.turnCard.dataset.turn = status.turn;
  els.turnLabel.textContent = status.title;
  els.turnSub.textContent = status.sub;
  els.revealCount.textContent = String(state.revealedCount);
  els.quietCount.textContent = String(state.quietPlies);
  renderCaptured(els.capturedRed, state.capturedBy.red);
  renderCaptured(els.capturedBlack, state.capturedBy.black);
}

function updateModeUi() {
  const copy = MODE_COPY[game.mode];
  const standard = game.mode === "standard";

  els.modeTitle.textContent = copy.title;
  els.modeSubtitle.textContent = copy.subtitle;
  els.revealStat.hidden = standard;
  els.debugOption.hidden = standard;

  if (standard) {
    debug = false;
    els.debugToggle.checked = false;
  }

  els.rulesList.replaceChildren();
  for (const text of copy.rules) {
    const item = document.createElement("li");
    item.textContent = text;
    els.rulesList.appendChild(item);
  }
}

function renderNotation() {
  const total = game.history.length;
  const reviewing = reviewPly !== null;
  const currentPly = reviewing ? reviewPly : total;

  els.reviewStatus.textContent = reviewing
    ? `复盘：第 ${currentPly} / ${total} 手`
    : `共 ${total} 手`;
  els.reviewStart.disabled = total === 0 || (reviewing && currentPly === 0);
  els.reviewPrev.disabled = total === 0 || (reviewing && currentPly === 0);
  els.reviewNext.disabled = !reviewing || currentPly >= total;
  els.reviewCurrent.disabled = !reviewing;
  els.undoMove.disabled = reviewing || total === 0;
  els.emptyNotation.hidden = currentPly !== 0;
  els.emptyNotation.textContent = total === 0 ? "暂无走子" : "开局，尚未走子";
  els.moveList.hidden = currentPly === 0;
  els.moveList.replaceChildren();

  game.history.slice(0, currentPly).forEach((entry, index) => {
    const ply = index + 1;
    const item = document.createElement("li");
    const button = document.createElement("button");
    const main = document.createElement("span");
    const mover = entry.mover === RED ? "红方" : "黑方";
    const from = entry.move.from;
    const to = entry.move.to;
    const details = [];

    if (entry.wasReveal) {
      details.push(`翻出「${KIND_LABEL[entry.mover][entry.revealedKind]}」`);
    }
    if (entry.captured) {
      const captured = entry.captured;
      const side = captured.color === RED ? "红方" : "黑方";
      const label = KIND_LABEL[captured.color][captured.kind];
      details.push(captured.revealed ? `吃${side}「${label}」` : `吃${side}暗子「${label}」`);
    }
    if (entry.gaveCheck) details.push("将军");

    button.type = "button";
    button.className = `move-entry${ply === currentPly ? " current" : ""}`;
    button.dataset.ply = String(ply);
    main.className = "move-main";
    main.textContent = `${ply}. ${mover} (${from.r},${from.c}) → (${to.r},${to.c})`;
    button.appendChild(main);

    if (details.length) {
      const detail = document.createElement("span");
      detail.className = "move-detail";
      detail.textContent = details.join(" · ");
      button.appendChild(detail);
    }

    item.appendChild(button);
    els.moveList.appendChild(item);
  });

  const current = els.moveList.querySelector(".move-entry.current");
  if (current) {
    els.moveList.scrollTop = Math.max(0, current.offsetTop - els.moveList.clientHeight + current.offsetHeight);
  }
}

function refresh() {
  let state = game;
  if (reviewPly !== null) {
    state = game.snapshotAt(reviewPly);
    if (!state) {
      reviewPly = null;
      state = game;
    }
  }

  const reviewing = reviewPly !== null;
  renderBoard(canvas, state, {
    selected: reviewing ? null : selected,
    legal: reviewing ? [] : legal,
    debug: reviewing ? false : debug,
  });
  updatePanel(state);
  els.debugToggle.disabled = reviewing;
  renderNotation();
}

function saveCurrentMatch() {
  if (!hasActiveMatch) return { ok: true };
  const result = saveMatch({
    game,
    aiEnabled,
    difficulty: currentDifficulty,
  });
  if (!result.ok) {
    els.message.textContent = "当前对局可继续，但未能写入本地存档。";
  }
  return result;
}

function cancelAi() {
  aiToken += 1;
  if (aiTimer !== null) {
    window.clearTimeout(aiTimer);
    aiTimer = null;
  }
  aiThinking = false;
}

function maybeRunAi() {
  if (
    !hasActiveMatch ||
    !aiEnabled ||
    reviewPly !== null ||
    !els.startScreen.hidden ||
    game.status !== "playing" ||
    game.turn !== AI_COLOR ||
    aiTimer !== null
  ) {
    return;
  }

  const token = ++aiToken;
  const targetGame = game;
  const targetPly = game.history.length;
  aiThinking = true;
  clearSelection();
  refresh();

  aiTimer = window.setTimeout(() => {
    if (token !== aiToken) return;
    aiTimer = null;

    const contextValid = () =>
      token === aiToken &&
      targetGame === game &&
      targetPly === game.history.length &&
      reviewPly === null &&
      els.startScreen.hidden &&
      aiEnabled &&
      game.status === "playing" &&
      game.turn === AI_COLOR;

    if (!contextValid()) {
      aiThinking = false;
      refresh();
      return;
    }

    const difficulty = AI_DIFFICULTIES[currentDifficulty];
    const move = chooseMove(targetGame, AI_COLOR, {
      depth: difficulty.depth,
      timeLimit: difficulty.timeLimit,
    });

    if (!contextValid()) {
      aiThinking = false;
      refresh();
      return;
    }

    aiThinking = false;
    if (!move) {
      refresh();
      return;
    }

    const result = targetGame.play(move);
    els.message.textContent = result.ok
      ? describeMove(result) || "AI 已走子"
      : result.reason;
    refresh();
    if (result.ok) saveCurrentMatch();
  }, 200);
}

function describeMove(result) {
  const mover = result.mover === RED ? "红方" : "黑方";
  const parts = [];

  if (result.wasReveal) {
    parts.push(`翻出「${KIND_LABEL[result.mover][result.revealedKind]}」`);
  }

  if (result.capture) {
    const capturedSide = result.capture.color === RED ? "红" : "黑";
    const label = KIND_LABEL[result.capture.color][result.capture.kind];
    parts.push(
      result.capture.revealed
        ? `吃掉${capturedSide}方「${label}」`
        : `吃掉${capturedSide}方暗子「${label}」`,
    );
  }

  return parts.length ? `${mover}：${parts.join("，")}` : "";
}

function enterReview(ply) {
  if (!Number.isInteger(ply) || ply < 0 || ply > game.history.length) return;
  cancelAi();
  reviewPly = ply;
  clearSelection();
  refresh();
}

function exitReview() {
  if (reviewPly === null) return;
  reviewPly = null;
  clearSelection();
  els.message.textContent = "已返回当前对局。";
  refresh();
  maybeRunAi();
}

function startMatch() {
  const checked = document.querySelector('input[name="game-mode"]:checked');
  const mode = checked?.value === "standard" ? "standard" : "jieqi";

  cancelAi();
  currentDifficulty = AI_DIFFICULTIES[els.startDifficulty.value]
    ? els.startDifficulty.value
    : "normal";
  els.difficulty.value = currentDifficulty;
  game = new JieqiGame({ mode });
  hasActiveMatch = true;
  reviewPly = null;
  clearSelection();
  debug = false;
  els.debugToggle.checked = false;
  els.startScreen.hidden = true;
  els.continueGame.hidden = true;
  els.startMessage.textContent = "";
  updateModeUi();
  els.message.textContent = `${MODE_COPY[mode].title}开始，红方先行。`;
  refresh();
  saveCurrentMatch();
  maybeRunAi();
}

function handleBoardTap(clientX, clientY) {
  if (!hasActiveMatch || reviewPly !== null || !els.startScreen.hidden) return;
  if (aiThinking || (aiEnabled && game.turn === AI_COLOR)) return;
  if (game.status !== "playing") return;

  const hit = hitTest(canvas, clientX, clientY);
  if (!hit) {
    clearSelection();
    refresh();
    return;
  }

  const { r, c } = hit;

  if (selected) {
    if (selected.r === r && selected.c === c) {
      clearSelection();
      refresh();
      return;
    }

    const move = legal.find((item) => item.to.r === r && item.to.c === c);
    if (move) {
      const result = game.play(move);
      clearSelection();
      els.message.textContent = result.ok
        ? describeMove(result) || "已走子"
        : result.reason;
      refresh();
      if (result.ok) {
        saveCurrentMatch();
        maybeRunAi();
      }
      return;
    }
  }

  const piece = game.board[r][c];
  if (piece && piece.color === game.turn) {
    selected = { r, c };
    legal = game.getLegalMovesFrom(r, c);
    els.message.textContent =
      legal.length === 0 ? "这枚棋子当前没有合法走法。" : "";
  } else {
    clearSelection();
  }

  refresh();
}

/* 鼠标点击 */
canvas.addEventListener("click", (event) => {
  handleBoardTap(event.clientX, event.clientY);
});

/* 触摸事件：阻止默认行为防止滚动，用 changedTouches 取坐标 */
canvas.addEventListener("touchstart", (event) => {
  if (event.touches.length !== 1) return;
  event.preventDefault();
  const touch = event.changedTouches[0];
  handleBoardTap(touch.clientX, touch.clientY);
}, { passive: false });

els.startGame.addEventListener("click", startMatch);

els.continueGame.addEventListener("click", () => {
  if (!hasActiveMatch) return;
  els.startScreen.hidden = true;
  els.startMessage.textContent = "";
  refresh();
  maybeRunAi();
});

els.newGame.addEventListener("click", () => {
  cancelAi();
  game.reset();
  hasActiveMatch = true;
  reviewPly = null;
  clearSelection();
  els.message.textContent = `${MODE_COPY[game.mode].title}新开一局，红方先行。`;
  refresh();
  saveCurrentMatch();
  maybeRunAi();
});

els.changeMode.addEventListener("click", () => {
  cancelAi();
  reviewPly = null;
  clearSelection();
  els.startDifficulty.value = currentDifficulty;
  const radio = document.querySelector(
    `input[name="game-mode"][value="${game.mode}"]`,
  );
  if (radio) radio.checked = true;
  els.continueGame.hidden = !hasActiveMatch;
  els.startMessage.textContent = "";
  els.startScreen.hidden = false;
  refresh();
});

els.undoMove.addEventListener("click", () => {
  if (reviewPly !== null || game.history.length === 0) return;

  cancelAi();
  const undoRound = aiEnabled && game.turn === RED && game.history.length > 1;
  const steps = undoRound ? 2 : 1;
  const target = Math.max(0, game.history.length - steps);
  if (!game.undoTo(target)) return;

  reviewPly = null;
  clearSelection();
  els.message.textContent = undoRound ? "已撤销上一轮双方走子。" : "已撤销上一手。";
  refresh();
  saveCurrentMatch();
});

els.reviewStart.addEventListener("click", () => enterReview(0));
els.reviewPrev.addEventListener("click", () => {
  const current = reviewPly ?? game.history.length;
  enterReview(Math.max(0, current - 1));
});
els.reviewNext.addEventListener("click", () => {
  if (reviewPly === null) return;
  enterReview(Math.min(game.history.length, reviewPly + 1));
});
els.reviewCurrent.addEventListener("click", exitReview);
els.moveList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-ply]");
  if (button) enterReview(Number(button.dataset.ply));
});

els.difficulty.addEventListener("change", () => {
  currentDifficulty = AI_DIFFICULTIES[els.difficulty.value]
    ? els.difficulty.value
    : "normal";
  els.startDifficulty.value = currentDifficulty;
  cancelAi();
  els.message.textContent = `AI 难度已调整为「${AI_DIFFICULTIES[currentDifficulty].label}」。`;
  refresh();
  saveCurrentMatch();
  maybeRunAi();
});

els.aiToggle.addEventListener("change", () => {
  aiEnabled = els.aiToggle.checked;
  cancelAi();
  els.message.textContent = aiEnabled
    ? "已开启人机对战，AI 执黑。"
    : "已切换为双人同屏。";
  refresh();
  saveCurrentMatch();
  maybeRunAi();
});

els.debugToggle.addEventListener("change", () => {
  debug = els.debugToggle.checked;
  refresh();
});

window.addEventListener("pagehide", () => {
  if (!hasActiveMatch) return;
  saveMatch({ game, aiEnabled, difficulty: currentDifficulty });
});

const restored = loadMatch();
if (restored.status === "ok") {
  game = restored.match.game;
  aiEnabled = restored.match.aiEnabled;
  currentDifficulty = restored.match.difficulty;
  hasActiveMatch = true;
  els.aiToggle.checked = aiEnabled;
  els.difficulty.value = currentDifficulty;
  els.startDifficulty.value = currentDifficulty;
  els.startScreen.hidden = true;
  els.continueGame.hidden = true;
  els.message.textContent = "已恢复本地对局。";
} else {
  aiEnabled = els.aiToggle.checked;
  els.startScreen.hidden = false;
  els.continueGame.hidden = true;
  if (restored.status === "error") {
    els.startMessage.textContent = "本地存档不可用，可以开始新对局。";
  }
}

updateModeUi();

if (window.ResizeObserver && canvas.parentElement) {
  new ResizeObserver(() => refresh()).observe(canvas.parentElement);
}

refresh();
maybeRunAi();
