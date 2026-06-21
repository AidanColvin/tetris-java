"use strict";

// ============================================================================
// Client-side Tetris engine — a faithful JavaScript port of the Java engine in
// src/main/java/com/tetris/game/. Same SRS rotation + wall kicks, 7-bag,
// guideline scoring, gravity curve, hold and hard drop. This version runs
// entirely in the browser so it can be hosted statically on Vercel.
// ============================================================================

const WIDTH = 10;
const HEIGHT = 20;
const CELL = 30;

// Color index 1-7 (matches the Java Tetromino color indices).
const COLORS = {
    1: "#22d3ee", 2: "#facc15", 3: "#a855f7", 4: "#22c55e",
    5: "#ef4444", 6: "#3b82f6", 7: "#f97316"
};

// Occupied cells {row, col} within the bounding box for each of the 4 rotations.
const SHAPES = {
    1: [[[1,0],[1,1],[1,2],[1,3]], [[0,2],[1,2],[2,2],[3,2]], [[2,0],[2,1],[2,2],[2,3]], [[0,1],[1,1],[2,1],[3,1]]],
    2: [[[0,0],[0,1],[1,0],[1,1]]],
    3: [[[0,1],[1,0],[1,1],[1,2]], [[0,1],[1,1],[1,2],[2,1]], [[1,0],[1,1],[1,2],[2,1]], [[0,1],[1,0],[1,1],[2,1]]],
    4: [[[0,1],[0,2],[1,0],[1,1]], [[0,1],[1,1],[1,2],[2,2]], [[1,1],[1,2],[2,0],[2,1]], [[0,0],[1,0],[1,1],[2,1]]],
    5: [[[0,0],[0,1],[1,1],[1,2]], [[0,2],[1,1],[1,2],[2,1]], [[1,0],[1,1],[2,1],[2,2]], [[0,1],[1,0],[1,1],[2,0]]],
    6: [[[0,0],[1,0],[1,1],[1,2]], [[0,1],[0,2],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,0],[2,1]]],
    7: [[[0,2],[1,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[1,2],[2,0]], [[0,0],[0,1],[1,1],[2,1]]]
};

// SRS wall-kick tables as {dRow, dCol}, keyed by from*4 + to.
const JLSTZ_KICKS = {
    1:  [[0,0],[0,-1],[-1,-1],[2,0],[2,-1]],   // 0->1
    4:  [[0,0],[0,1],[1,1],[-2,0],[-2,1]],     // 1->0
    6:  [[0,0],[0,1],[1,1],[-2,0],[-2,1]],     // 1->2
    9:  [[0,0],[0,-1],[-1,-1],[2,0],[2,-1]],   // 2->1
    11: [[0,0],[0,1],[-1,1],[2,0],[2,1]],      // 2->3
    14: [[0,0],[0,-1],[1,-1],[-2,0],[-2,-1]],  // 3->2
    12: [[0,0],[0,-1],[1,-1],[-2,0],[-2,-1]],  // 3->0
    3:  [[0,0],[0,1],[-1,1],[2,0],[2,1]]       // 0->3
};
const I_KICKS = {
    1:  [[0,0],[0,-2],[0,1],[1,-2],[-2,1]],    // 0->1
    4:  [[0,0],[0,2],[0,-1],[-1,2],[2,-1]],    // 1->0
    6:  [[0,0],[0,-1],[0,2],[-2,-1],[1,2]],    // 1->2
    9:  [[0,0],[0,1],[0,-2],[2,1],[-1,-2]],    // 2->1
    11: [[0,0],[0,2],[0,-1],[-1,2],[2,-1]],    // 2->3
    14: [[0,0],[0,-2],[0,1],[1,-2],[-2,1]],    // 3->2
    12: [[0,0],[0,1],[0,-2],[2,1],[-1,-2]],    // 3->0
    3:  [[0,0],[0,-1],[0,2],[-2,-1],[1,2]]     // 0->3
};

class TetrisGame {
    constructor() { this.reset(); }

    reset() {
        this.grid = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(0));
        this.bag = [];
        this.queue = [];
        this.hold = 0;
        this.holdUsed = false;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.running = false;
        this.gameOver = false;
        this.dropAccMs = 0;
        this.current = 0;
        this.rot = 0;
        this.row = 0;
        this.col = 0;
        this.fillQueue();
    }

    start() {
        this.reset();
        this.running = true;
        this.spawn();
    }

    isRunning() { return this.running && !this.gameOver; }

    fillQueue() {
        while (this.queue.length < 5) {
            if (this.bag.length === 0) {
                this.bag = [1, 2, 3, 4, 5, 6, 7];
                for (let i = this.bag.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
                }
            }
            this.queue.push(this.bag.shift());
        }
    }

    spawn() {
        this.fillQueue();
        this.current = this.queue.shift();
        this.fillQueue();
        this.rot = 0;
        this.col = this.current === 2 ? 4 : 3;
        this.row = 0;
        this.holdUsed = false;
        this.dropAccMs = 0;
        if (this.collides(this.current, this.rot, this.row, this.col)) {
            this.gameOver = true;
            this.running = false;
        }
    }

    cells(type, rotation) {
        const states = SHAPES[type];
        return states[((rotation % states.length) + states.length) % states.length];
    }

    collides(type, rotation, r, c) {
        for (const [br, bc] of this.cells(type, rotation)) {
            const x = c + bc, y = r + br;
            if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return true;
            if (this.grid[y][x] !== 0) return true;
        }
        return false;
    }

    canAct() { return this.running && !this.gameOver && this.current !== 0; }

    moveLeft() { if (this.canAct() && !this.collides(this.current, this.rot, this.row, this.col - 1)) this.col--; }
    moveRight() { if (this.canAct() && !this.collides(this.current, this.rot, this.row, this.col + 1)) this.col++; }

    softDrop() {
        if (!this.canAct()) return;
        if (!this.collides(this.current, this.rot, this.row + 1, this.col)) {
            this.row++;
            this.score += 1;
            this.dropAccMs = 0;
        } else {
            this.lockPiece();
        }
    }

    hardDrop() {
        if (!this.canAct()) return;
        let dropped = 0;
        while (!this.collides(this.current, this.rot, this.row + 1, this.col)) { this.row++; dropped++; }
        this.score += dropped * 2;
        this.lockPiece();
    }

    rotate(clockwise) {
        if (!this.canAct() || this.current === 2) return;
        const from = this.rot;
        const to = (this.rot + (clockwise ? 1 : 3)) % 4;
        const table = this.current === 1 ? I_KICKS : JLSTZ_KICKS;
        const kicks = table[from * 4 + to] || [[0, 0]];
        for (const [dRow, dCol] of kicks) {
            const nr = this.row + dRow, nc = this.col + dCol;
            if (!this.collides(this.current, to, nr, nc)) {
                this.rot = to; this.row = nr; this.col = nc;
                return;
            }
        }
    }

    holdPiece() {
        if (!this.canAct() || this.holdUsed) return;
        const swap = this.hold;
        this.hold = this.current;
        if (swap === 0) {
            this.spawn();
        } else {
            this.current = swap;
            this.rot = 0;
            this.col = this.current === 2 ? 4 : 3;
            this.row = 0;
            if (this.collides(this.current, this.rot, this.row, this.col)) {
                this.gameOver = true; this.running = false;
            }
        }
        this.holdUsed = true;
    }

    tick(elapsedMs) {
        if (!this.isRunning()) return;
        this.dropAccMs += elapsedMs;
        const interval = this.gravityIntervalMs();
        while (this.dropAccMs >= interval && this.isRunning()) {
            this.dropAccMs -= interval;
            if (!this.collides(this.current, this.rot, this.row + 1, this.col)) this.row++;
            else this.lockPiece();
        }
    }

    gravityIntervalMs() {
        const seconds = Math.pow(0.8 - (this.level - 1) * 0.007, this.level - 1);
        return Math.max(20, seconds * 1000);
    }

    lockPiece() {
        for (const [br, bc] of this.cells(this.current, this.rot)) {
            const y = this.row + br, x = this.col + bc;
            if (y >= 0 && y < HEIGHT && x >= 0 && x < WIDTH) this.grid[y][x] = this.current;
        }
        this.applyScore(this.clearLines());
        this.spawn();
    }

    clearLines() {
        let cleared = 0;
        for (let r = HEIGHT - 1; r >= 0; r--) {
            if (this.grid[r].every(v => v !== 0)) {
                cleared++;
                for (let rr = r; rr > 0; rr--) this.grid[rr] = this.grid[rr - 1].slice();
                this.grid[0] = new Array(WIDTH).fill(0);
                r++; // re-check the shifted row
            }
        }
        return cleared;
    }

    applyScore(cleared) {
        const points = { 1: 100, 2: 300, 3: 500, 4: 800 }[cleared] || 0;
        this.score += points * this.level;
        if (cleared > 0) {
            this.lines += cleared;
            this.level = Math.floor(this.lines / 10) + 1;
        }
    }

    ghostCells() {
        if (!this.canAct()) return [];
        let gr = this.row;
        while (!this.collides(this.current, this.rot, gr + 1, this.col)) gr++;
        return this.cells(this.current, this.rot).map(([br, bc]) => [gr + br, this.col + bc]);
    }

    activeCells() {
        if (this.current === 0) return [];
        return this.cells(this.current, this.rot).map(([br, bc]) => [this.row + br, this.col + bc]);
    }

    snapshot() {
        return {
            grid: this.grid,
            active: this.activeCells(),
            activeColor: this.current,
            ghost: this.ghostCells(),
            next: this.queue.slice(0, 4),
            hold: this.hold,
            score: this.score,
            lines: this.lines,
            level: this.level,
            running: this.running,
            gameOver: this.gameOver
        };
    }
}

// ============================================================================
// Rendering
// ============================================================================

const boardCanvas = document.getElementById("board");
const bctx = boardCanvas.getContext("2d");
const holdCanvas = document.getElementById("hold");
const hctx = holdCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nctx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const leaderboardEl = document.getElementById("leaderboard");

const MINI_SHAPES = {
    1: [[0,0],[0,1],[0,2],[0,3]], 2: [[0,0],[0,1],[1,0],[1,1]],
    3: [[0,1],[1,0],[1,1],[1,2]], 4: [[0,1],[0,2],[1,0],[1,1]],
    5: [[0,0],[0,1],[1,1],[1,2]], 6: [[0,0],[1,0],[1,1],[1,2]],
    7: [[0,2],[1,0],[1,1],[1,2]]
};

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawCell(ctx, x, y, size, colorIndex, ghost) {
    const color = COLORS[colorIndex] || "#64748b";
    const pad = Math.max(1, Math.floor(size * 0.06));
    if (ghost) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + pad + 1, y + pad + 1, size - 2 * pad - 2, size - 2 * pad - 2);
        ctx.globalAlpha = 1;
        return;
    }
    ctx.fillStyle = color;
    roundRect(ctx, x + pad, y + pad, size - 2 * pad, size - 2 * pad, Math.floor(size * 0.16));
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x + pad, y + pad, size - 2 * pad, Math.max(2, Math.floor(size * 0.12)));
}

function drawMini(ctx, canvas, colorIndices) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cell = 24;
    colorIndices.forEach((colorIndex, i) => {
        if (!colorIndex) return;
        const offY = i * 90 + 12;
        const offX = (canvas.width - 4 * cell) / 2 + 8;
        MINI_SHAPES[colorIndex].forEach(([r, c]) => {
            drawCell(ctx, offX + c * cell, offY + r * cell, cell, colorIndex, false);
        });
    });
}

function render(state) {
    bctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    bctx.strokeStyle = "rgba(255,255,255,0.04)";
    bctx.lineWidth = 1;
    for (let c = 1; c < WIDTH; c++) {
        bctx.beginPath(); bctx.moveTo(c * CELL + 0.5, 0); bctx.lineTo(c * CELL + 0.5, HEIGHT * CELL); bctx.stroke();
    }
    for (let r = 1; r < HEIGHT; r++) {
        bctx.beginPath(); bctx.moveTo(0, r * CELL + 0.5); bctx.lineTo(WIDTH * CELL, r * CELL + 0.5); bctx.stroke();
    }
    for (let r = 0; r < state.grid.length; r++) {
        for (let c = 0; c < state.grid[r].length; c++) {
            if (state.grid[r][c] !== 0) drawCell(bctx, c * CELL, r * CELL, CELL, state.grid[r][c], false);
        }
    }
    state.ghost.forEach(([r, c]) => drawCell(bctx, c * CELL, r * CELL, CELL, state.activeColor, true));
    state.active.forEach(([r, c]) => { if (r >= 0) drawCell(bctx, c * CELL, r * CELL, CELL, state.activeColor, false); });

    drawMini(hctx, holdCanvas, [state.hold || 0]);
    drawMini(nctx, nextCanvas, state.next || []);

    scoreEl.textContent = state.score;
    linesEl.textContent = state.lines;
    levelEl.textContent = state.level;
}

// ============================================================================
// Game loop, input, overlay, leaderboard
// ============================================================================

const game = new TetrisGame();
let lastTime = 0;
let wasRunning = false;
let submitting = false;

function loop(now) {
    if (!lastTime) lastTime = now;
    const dt = now - lastTime;
    lastTime = now;
    game.tick(dt);
    const state = game.snapshot();
    render(state);

    if (state.running && !state.gameOver) {
        overlay.classList.add("hidden");
        wasRunning = true;
    } else if (state.gameOver && wasRunning) {
        wasRunning = false;
        showGameOver(state);
    }
    requestAnimationFrame(loop);
}

function el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.text) node.textContent = opts.text;
    if (opts.class) node.className = opts.class;
    return node;
}

function startNew() {
    game.start();
    overlay.classList.add("hidden");
    wasRunning = true;
}

function showGameOver(state) {
    overlay.classList.remove("hidden");
    const card = overlay.querySelector(".overlay-card");
    card.innerHTML = "";

    const input = el("input", { class: "name-input" });
    input.type = "text";
    input.maxLength = 16;
    input.placeholder = "Your name";
    input.value = localStorage.getItem("tetris-name") || "";

    const submit = el("button", { text: "Submit Score" });
    submit.addEventListener("click", () => {
        if (submitting) return;
        submitting = true;
        submit.disabled = true;
        const name = (input.value || "Anonymous").trim();
        localStorage.setItem("tetris-name", name);
        submitScore(name, state).finally(() => { submitting = false; startNew(); });
    });

    const again = el("button", { text: "Play Again" });
    again.style.marginTop = "10px";
    again.addEventListener("click", startNew);

    card.append(
        el("h2", { text: "Game Over" }),
        el("p", { text: `Score ${state.score} · Level ${state.level} · ${state.lines} lines` }),
        input, submit, again
    );
    input.focus();
}

// --- Leaderboard (Vercel serverless function, with localStorage fallback) ---
function localScores() {
    try { return JSON.parse(localStorage.getItem("tetris-scores") || "[]"); } catch (e) { return []; }
}
function saveLocal(entry) {
    const list = localScores();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    localStorage.setItem("tetris-scores", JSON.stringify(list.slice(0, 20)));
    return list;
}

async function loadLeaderboard() {
    try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error("bad status");
        renderLeaderboard(await res.json());
    } catch (e) {
        renderLeaderboard(localScores());
    }
}

async function submitScore(name, state) {
    const entry = { name, score: state.score, lines: state.lines, level: state.level };
    saveLocal(entry);
    try {
        const res = await fetch("/api/leaderboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry)
        });
        if (!res.ok) throw new Error("bad status");
        renderLeaderboard(await res.json());
    } catch (e) {
        renderLeaderboard(localScores());
    }
}

function renderLeaderboard(entries) {
    leaderboardEl.innerHTML = "";
    if (!entries || entries.length === 0) {
        leaderboardEl.append(el("li", { class: "empty", text: "No scores yet" }));
        return;
    }
    entries.slice(0, 10).forEach((e) => {
        const li = document.createElement("li");
        const row = el("div", { class: "row" });
        row.append(el("span", { class: "name", text: e.name }), el("span", { class: "pts", text: e.score }));
        li.append(row);
        leaderboardEl.append(li);
    });
}

// --- Input ---
const KEYMAP = {
    ArrowLeft: () => game.moveLeft(),
    ArrowRight: () => game.moveRight(),
    ArrowDown: () => game.softDrop(),
    ArrowUp: () => game.rotate(true),
    KeyX: () => game.rotate(true),
    KeyZ: () => game.rotate(false),
    Space: () => game.hardDrop(),
    KeyC: () => game.holdPiece()
};

window.addEventListener("keydown", (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    e.preventDefault();
    if (e.code === "Space" && e.repeat) return;
    action();
    render(game.snapshot());
});

document.getElementById("start-btn").addEventListener("click", startNew);

loadLeaderboard();
render(game.snapshot());
requestAnimationFrame(loop);
