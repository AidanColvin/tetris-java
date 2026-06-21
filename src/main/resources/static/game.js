"use strict";

// --- Constants ---
const COLS = 10;
const ROWS = 20;
const CELL = 30; // board canvas is 300x600

// Color index -> { fill, light } matching the Java Tetromino color indices.
const COLORS = {
    1: "#22d3ee", // I - cyan
    2: "#facc15", // O - yellow
    3: "#a855f7", // T - purple
    4: "#22c55e", // S - green
    5: "#ef4444", // Z - red
    6: "#3b82f6", // J - blue
    7: "#f97316"  // L - orange
};

// --- DOM ---
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
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const connEl = document.getElementById("conn");
const leaderboardEl = document.getElementById("leaderboard");

// --- State ---
let socket = null;
let lastState = null;
let wasRunning = false;
let submitting = false;

// --- WebSocket ---
function connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${proto}://${location.host}/ws/game`);

    socket.onopen = () => setConn("connected", "ok");
    socket.onclose = () => {
        setConn("disconnected — retrying", "bad");
        setTimeout(connect, 1500);
    };
    socket.onerror = () => setConn("connection error", "bad");
    socket.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "state") {
            handleState(msg);
        }
    };
}

function setConn(text, cls) {
    connEl.textContent = text;
    connEl.className = "conn " + (cls || "");
}

function send(obj) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(obj));
    }
}

// --- State handling ---
function handleState(state) {
    lastState = state;
    scoreEl.textContent = state.score;
    linesEl.textContent = state.lines;
    levelEl.textContent = state.level;

    render(state);

    if (state.running && !state.gameOver) {
        hideOverlay();
        wasRunning = true;
    } else if (state.gameOver && wasRunning) {
        wasRunning = false;
        showGameOver(state);
    }
}

// --- Rendering ---
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
    // top-left highlight for a little depth
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x + pad, y + pad, size - 2 * pad, Math.max(2, Math.floor(size * 0.12)));
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function render(state) {
    bctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

    // grid lines
    bctx.strokeStyle = "rgba(255,255,255,0.04)";
    bctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
        bctx.beginPath();
        bctx.moveTo(c * CELL + 0.5, 0);
        bctx.lineTo(c * CELL + 0.5, ROWS * CELL);
        bctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
        bctx.beginPath();
        bctx.moveTo(0, r * CELL + 0.5);
        bctx.lineTo(COLS * CELL, r * CELL + 0.5);
        bctx.stroke();
    }

    // locked cells
    const grid = state.grid || [];
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] !== 0) {
                drawCell(bctx, c * CELL, r * CELL, CELL, grid[r][c], false);
            }
        }
    }

    // ghost
    (state.ghost || []).forEach(([r, c]) => {
        drawCell(bctx, c * CELL, r * CELL, CELL, state.activeColor, true);
    });

    // active piece
    (state.active || []).forEach(([r, c]) => {
        if (r >= 0) drawCell(bctx, c * CELL, r * CELL, CELL, state.activeColor, false);
    });

    renderSidePanels(state);
}

function drawMini(ctx, canvas, colorIndices) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cell = 24;
    colorIndices.forEach((colorIndex, i) => {
        if (!colorIndex) return;
        const cells = MINI_SHAPES[colorIndex];
        const offY = i * 90 + 12;
        const offX = (canvas.width - 4 * cell) / 2 + 8;
        cells.forEach(([r, c]) => {
            drawCell(ctx, offX + c * cell, offY + r * cell, cell, colorIndex, false);
        });
    });
}

// Spawn-orientation shapes for the hold/next previews (color index -> cells).
const MINI_SHAPES = {
    1: [[0, 0], [0, 1], [0, 2], [0, 3]], // I
    2: [[0, 0], [0, 1], [1, 0], [1, 1]], // O
    3: [[0, 1], [1, 0], [1, 1], [1, 2]], // T
    4: [[0, 1], [0, 2], [1, 0], [1, 1]], // S
    5: [[0, 0], [0, 1], [1, 1], [1, 2]], // Z
    6: [[0, 0], [1, 0], [1, 1], [1, 2]], // J
    7: [[0, 2], [1, 0], [1, 1], [1, 2]]  // L
};

function renderSidePanels(state) {
    drawMini(hctx, holdCanvas, [state.hold || 0]);
    drawMini(nctx, nextCanvas, state.next || []);
}

// --- Overlay / game over ---
function hideOverlay() {
    overlay.classList.add("hidden");
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
        submitScore(name, state).finally(() => {
            submitting = false;
            startNew();
        });
    });

    card.append(
        el("h2", { text: "Game Over" }),
        el("p", { text: `Score ${state.score} · Level ${state.level} · ${state.lines} lines` }),
        input,
        submit,
        startButton("Play Again", true)
    );
    input.focus();
}

function startButton(label, secondary) {
    const b = el("button", { text: label });
    if (secondary) b.style.marginTop = "10px";
    b.addEventListener("click", startNew);
    return b;
}

function startNew() {
    send({ type: "start" });
}

function el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.text) node.textContent = opts.text;
    if (opts.class) node.className = opts.class;
    if (opts.id) node.id = opts.id;
    return node;
}

// --- Leaderboard ---
async function loadLeaderboard() {
    try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        renderLeaderboard(data);
    } catch (e) {
        // ignore
    }
}

async function submitScore(name, state) {
    try {
        const res = await fetch("/api/leaderboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name,
                score: state.score,
                lines: state.lines,
                level: state.level
            })
        });
        const data = await res.json();
        renderLeaderboard(data);
    } catch (e) {
        // ignore
    }
}

function renderLeaderboard(entries) {
    leaderboardEl.innerHTML = "";
    if (!entries || entries.length === 0) {
        const li = el("li", { class: "empty", text: "No scores yet" });
        leaderboardEl.append(li);
        return;
    }
    entries.slice(0, 10).forEach((e) => {
        const li = document.createElement("li");
        const row = el("div", { class: "row" });
        row.append(
            el("span", { class: "name", text: e.name }),
            el("span", { class: "pts", text: e.score })
        );
        li.append(row);
        leaderboardEl.append(li);
    });
}

// --- Input ---
const KEYMAP = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "softDrop",
    ArrowUp: "rotateCW",
    KeyX: "rotateCW",
    KeyZ: "rotateCCW",
    Space: "hardDrop",
    KeyC: "hold"
};

window.addEventListener("keydown", (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    e.preventDefault();
    if (action === "hardDrop" && e.repeat) return; // no auto-repeat on hard drop
    send({ type: "input", action: action });
});

startBtn.addEventListener("click", startNew);

// --- Boot ---
connect();
loadLeaderboard();
