import { ROWS, COLS, RED, KIND_LABEL, findKing } from "../engine/core.js";

export const BASE_W = 560;
export const BASE_H = 620;

const PAD = 40;
const CELL = 60;
const RADIUS = 24;

const COLORS = {
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
  check: "#d33a2c",
};

export function point(r, c) {
  return { x: PAD + c * CELL, y: PAD + r * CELL };
}

export function hitTest(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * BASE_W;
  const y = ((clientY - rect.top) / rect.height) * BASE_H;

  const c = Math.round((x - PAD) / CELL);
  const r = Math.round((y - PAD) / CELL);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;

  const center = point(r, c);
  if (Math.hypot(x - center.x, y - center.y) > 30) return null;

  return { r, c };
}

export function renderBoard(canvas, game, view) {
  const ctx = canvas.getContext("2d");
  fitCanvas(canvas, ctx);

  drawBackground(ctx);
  drawGrid(ctx);
  drawLastMove(ctx, game);
  drawCheck(ctx, game);
  drawPieces(ctx, game, view);
  drawSelection(ctx, game, view);
}

function fitCanvas(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const parentWidth = canvas.parentElement
    ? canvas.parentElement.clientWidth
    : BASE_W;
  const available = Math.max(280, parentWidth);
  const scale = Math.min(1, available / BASE_W);

  canvas.style.width = `${BASE_W * scale}px`;
  canvas.style.height = `${BASE_H * scale}px`;
  canvas.width = Math.round(BASE_W * scale * dpr);
  canvas.height = Math.round(BASE_H * scale * dpr);

  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
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
  ctx.fillText("楚 河", PAD + 2 * CELL, PAD + 4.5 * CELL);
  ctx.fillText("汉 界", PAD + 6 * CELL, PAD + 4.5 * CELL);
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
