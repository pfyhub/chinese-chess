import { RED, OPPOSITE } from "./core.js";
import { createBoard, createStandardBoard } from "./setup.js";
import {
  applyMove,
  getAttackedEnemyIds,
  getLegalMoves,
  getLegalMovesFrom,
  isInCheck,
} from "./moves.js";
import { judgeRepetition } from "./repetition.js";

function clonePiece(piece) {
  return piece ? { ...piece } : null;
}

function cloneLastMove(lastMove) {
  if (!lastMove) return null;
  return {
    ...lastMove,
    from: { ...lastMove.from },
    to: { ...lastMove.to },
    capture: lastMove.capture ? { ...lastMove.capture } : null,
  };
}

function cloneSnapshot(snapshot) {
  return {
    board: snapshot.board.map((row) => row.map(clonePiece)),
    turn: snapshot.turn,
    capturedBy: {
      red: snapshot.capturedBy.red.map(clonePiece),
      black: snapshot.capturedBy.black.map(clonePiece),
    },
    quietPlies: snapshot.quietPlies,
    revealedCount: snapshot.revealedCount,
    status: snapshot.status,
    winner: snapshot.winner,
    drawReason: snapshot.drawReason,
    lastMove: cloneLastMove(snapshot.lastMove),
    inCheck: snapshot.inCheck,
  };
}

export class JieqiGame {
  constructor(options = {}) {
    this.quietLimit = options.quietLimit ?? 80;
    this.mode = options.mode ?? "jieqi";
    this.reset(options.rng);
  }

  static fromArchive(archive) {
    if (!archive || !["jieqi", "standard"].includes(archive.mode)) {
      throw new Error("存档模式无效");
    }
    if (!archive.initial || !Array.isArray(archive.moves)) {
      throw new Error("存档缺少开局或走子记录");
    }

    const game = new JieqiGame({
      mode: archive.mode,
      quietLimit: archive.quietLimit ?? 80,
    });
    game.restoreInitial(archive.initial);

    for (let index = 0; index < archive.moves.length; index++) {
      const result = game.play(archive.moves[index]);
      if (!result.ok) {
        throw new Error(`存档第 ${index + 1} 手无效：${result.reason}`);
      }
    }

    return game;
  }

  reset(rng = Math.random) {
    this.board =
      this.mode === "standard" ? createStandardBoard() : createBoard(rng);
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
    this.positionCounts = new Map();
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
    this.positionCounts = new Map();
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
        to: { ...move.to },
      })),
    };
  }

  positionKey(board = this.board, turn = this.turn) {
    const cells = board
      .map((row) =>
        row
          .map((piece) => {
            if (!piece) return ".";
            return `${piece.color[0]}${piece.kind}${piece.revealed ? "1" : "0"}${piece.homeRole}`;
          })
          .join(""),
      )
      .join("/");
    return `${turn}|${cells}`;
  }

  recordPosition() {
    const key = this.positionKey();
    const plies = this.positionCounts.get(key) || [];
    plies.push(this.history.length);
    this.positionCounts.set(key, plies);
  }

  rebuildPositionCounts() {
    this.positionCounts = new Map();
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
      return { ok: false, reason: "对局已结束" };
    }

    const piece = this.board[move.from.r][move.from.c];
    if (!piece || piece.color !== this.turn) {
      return { ok: false, reason: "不是当前方的棋子" };
    }

    const legal = getLegalMovesFrom(this.board, this.turn, move.from.r, move.from.c, {
      mode: this.mode,
    });
    if (!legal.some((item) => item.to.r === move.to.r && item.to.c === move.to.c)) {
      return { ok: false, reason: "不合法的走法" };
    }

    const mover = this.turn;
    const opponent = OPPOSITE[mover];
    const beforeAttacks = getAttackedEnemyIds(this.board, mover, {
      mode: this.mode,
    });
    const simulated = applyMove(this.board, move);
    this.board = simulated.board;
    const afterAttacks = getAttackedEnemyIds(this.board, mover, {
      mode: this.mode,
    });
    const chaseTargets = [...afterAttacks].filter((id) => !beforeAttacks.has(id));
    const kingCaptured = Boolean(
      simulated.captured && simulated.captured.kind === "K",
    );
    const gaveCheck =
      !kingCaptured && isInCheck(this.board, opponent, { mode: this.mode });

    this.lastMove = {
      from: { ...move.from },
      to: { ...move.to },
      mover,
      wasReveal: simulated.wasReveal,
      revealedKind: simulated.wasReveal ? simulated.piece.kind : null,
      capture: simulated.captured
        ? {
            color: simulated.captured.color,
            revealed: simulated.captured.revealed,
            kind: simulated.captured.kind,
          }
        : null,
    };
    this.history.push({
      move: {
        from: { ...move.from },
        to: { ...move.to },
      },
      mover,
      wasReveal: simulated.wasReveal,
      revealedKind: simulated.wasReveal ? simulated.piece.kind : null,
      captured: simulated.captured ? clonePiece(simulated.captured) : null,
      gaveCheck,
      chaseTargets,
    });

    if (simulated.captured) {
      this.capturedBy[mover].push(simulated.captured);
    }
    if (simulated.wasReveal) {
      this.revealedCount += 1;
    }
    this.quietPlies =
      simulated.captured || simulated.wasReveal ? 0 : this.quietPlies + 1;

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
}
