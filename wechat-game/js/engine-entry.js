// 打包入口：把引擎、绘制、存档聚合成一个 CommonJS 包
export { JieqiGame } from "../../src/engine/game.js";
export { RED, BLACK, ROWS, COLS, KIND_LABEL } from "../../src/engine/core.js";
export { AI_DIFFICULTIES, chooseMove } from "../../src/engine/ai.js";
export { drawBoard, hitTestPoint, BASE_W, BASE_H } from "../../src/ui/board.js";
export { loadMatch, saveMatch, clearMatch } from "../../src/storage.js";
