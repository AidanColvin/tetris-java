package com.tetris.game;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Authoritative Tetris game state and rules. All gameplay logic lives here,
 * in Java: the 10x20 playfield, SRS rotation with wall kicks, 7-bag piece
 * generation, line clears, scoring, leveling, gravity, hold and hard drop.
 *
 * Not thread-safe by itself; callers (the game session) synchronize access.
 */
public class TetrisGame {

    public static final int WIDTH = 10;
    public static final int HEIGHT = 20;

    private final int[][] grid = new int[HEIGHT][WIDTH]; // 0 = empty, else color index

    // Active piece
    private Tetromino current;
    private int rot;
    private int row;   // top-left of bounding box on the board
    private int col;

    // Piece generation
    private final List<Tetromino> bag = new ArrayList<>();
    private final java.util.Deque<Tetromino> queue = new java.util.ArrayDeque<>();
    private final java.util.Random random = new java.util.Random();

    private Tetromino hold;
    private boolean holdUsed;

    private int score;
    private int lines;
    private int level = 1;

    private boolean running;
    private boolean gameOver;

    // Gravity accumulator (milliseconds since last automatic drop)
    private double dropAccumulatorMs;

    public TetrisGame() {
        reset();
    }

    public synchronized void reset() {
        for (int[] r : grid) Arrays.fill(r, 0);
        bag.clear();
        queue.clear();
        hold = null;
        holdUsed = false;
        score = 0;
        lines = 0;
        level = 1;
        gameOver = false;
        running = false;
        dropAccumulatorMs = 0;
        current = null;
        fillQueue();
    }

    public void start() {
        reset();
        running = true;
        spawn();
    }

    public boolean isRunning() {
        return running && !gameOver;
    }

    // --- Piece generation: 7-bag randomizer ---

    private void fillQueue() {
        while (queue.size() < 5) {
            if (bag.isEmpty()) {
                bag.addAll(Arrays.asList(Tetromino.values()));
                Collections.shuffle(bag, random);
            }
            queue.addLast(bag.remove(0));
        }
    }

    private void spawn() {
        fillQueue();
        current = queue.pollFirst();
        fillQueue();
        rot = 0;
        col = (current == Tetromino.O) ? 4 : 3;
        row = 0;
        holdUsed = false;
        dropAccumulatorMs = 0;
        if (collides(current, rot, row, col)) {
            gameOver = true;
            running = false;
        }
    }

    // --- Collision ---

    private boolean collides(Tetromino piece, int rotation, int r, int c) {
        for (int[] cell : piece.cells(rotation)) {
            int br = r + cell[0];
            int bc = c + cell[1];
            if (bc < 0 || bc >= WIDTH || br < 0 || br >= HEIGHT) return true;
            if (grid[br][bc] != 0) return true;
        }
        return false;
    }

    // --- Player actions (no-ops unless a piece is in play) ---

    public boolean moveLeft() {
        if (!canAct()) return false;
        if (!collides(current, rot, row, col - 1)) { col--; return true; }
        return false;
    }

    public boolean moveRight() {
        if (!canAct()) return false;
        if (!collides(current, rot, row, col + 1)) { col++; return true; }
        return false;
    }

    /** Soft drop one row; awards 1 point per cell. Returns true if it moved. */
    public boolean softDrop() {
        if (!canAct()) return false;
        if (!collides(current, rot, row + 1, col)) {
            row++;
            score += 1;
            dropAccumulatorMs = 0;
            return true;
        }
        // Already resting: lock it in.
        lockPiece();
        return true;
    }

    /** Drop straight down, award 2 points per cell, and lock immediately. */
    public boolean hardDrop() {
        if (!canAct()) return false;
        int dropped = 0;
        while (!collides(current, rot, row + 1, col)) {
            row++;
            dropped++;
        }
        score += dropped * 2;
        lockPiece();
        return true;
    }

    public boolean rotate(boolean clockwise) {
        if (!canAct()) return false;
        if (current == Tetromino.O) return false;
        int from = rot;
        int to = ((rot + (clockwise ? 1 : 3)) % 4);
        for (int[] kick : current.kicks(from, to)) {
            int nr = row + kick[0];
            int nc = col + kick[1];
            if (!collides(current, to, nr, nc)) {
                rot = to;
                row = nr;
                col = nc;
                return true;
            }
        }
        return false;
    }

    public boolean hold() {
        if (!canAct() || holdUsed) return false;
        Tetromino swap = hold;
        hold = current;
        if (swap == null) {
            spawn();
        } else {
            current = swap;
            rot = 0;
            col = (current == Tetromino.O) ? 4 : 3;
            row = 0;
            if (collides(current, rot, row, col)) {
                gameOver = true;
                running = false;
            }
        }
        holdUsed = true;
        return true;
    }

    private boolean canAct() {
        return running && !gameOver && current != null;
    }

    // --- Gravity, called periodically with elapsed wall-clock time ---

    public boolean tick(long elapsedMs) {
        if (!isRunning()) return false;
        dropAccumulatorMs += elapsedMs;
        boolean changed = false;
        double interval = gravityIntervalMs();
        while (dropAccumulatorMs >= interval && isRunning()) {
            dropAccumulatorMs -= interval;
            if (!collides(current, rot, row + 1, col)) {
                row++;
            } else {
                lockPiece();
            }
            changed = true;
        }
        return changed;
    }

    private double gravityIntervalMs() {
        // Tetris Guideline gravity curve: seconds-per-row shrinks as level rises.
        double seconds = Math.pow(0.8 - ((level - 1) * 0.007), level - 1);
        return Math.max(20.0, seconds * 1000.0);
    }

    private void lockPiece() {
        for (int[] cell : current.cells(rot)) {
            int br = row + cell[0];
            int bc = col + cell[1];
            if (br >= 0 && br < HEIGHT && bc >= 0 && bc < WIDTH) {
                grid[br][bc] = current.colorIndex;
            }
        }
        int cleared = clearLines();
        applyScore(cleared);
        spawn();
    }

    private int clearLines() {
        int cleared = 0;
        for (int r = HEIGHT - 1; r >= 0; r--) {
            boolean full = true;
            for (int c = 0; c < WIDTH; c++) {
                if (grid[r][c] == 0) { full = false; break; }
            }
            if (full) {
                cleared++;
                for (int rr = r; rr > 0; rr--) {
                    System.arraycopy(grid[rr - 1], 0, grid[rr], 0, WIDTH);
                }
                Arrays.fill(grid[0], 0);
                r++; // re-check the row we just shifted down into
            }
        }
        return cleared;
    }

    private void applyScore(int cleared) {
        switch (cleared) {
            case 1 -> score += 100 * level;
            case 2 -> score += 300 * level;
            case 3 -> score += 500 * level;
            case 4 -> score += 800 * level;
            default -> { /* no lines */ }
        }
        if (cleared > 0) {
            lines += cleared;
            level = (lines / 10) + 1;
        }
    }

    // --- Ghost piece (landing preview) ---

    private int[][] ghostCells() {
        if (!canAct()) return new int[0][];
        int gr = row;
        while (!collides(current, rot, gr + 1, col)) {
            gr++;
        }
        int[][] base = current.cells(rot);
        int[][] out = new int[base.length][2];
        for (int i = 0; i < base.length; i++) {
            out[i][0] = gr + base[i][0];
            out[i][1] = col + base[i][1];
        }
        return out;
    }

    private int[][] activeCells() {
        if (current == null) return new int[0][];
        int[][] base = current.cells(rot);
        int[][] out = new int[base.length][2];
        for (int i = 0; i < base.length; i++) {
            out[i][0] = row + base[i][0];
            out[i][1] = col + base[i][1];
        }
        return out;
    }

    // --- Serializable snapshot for the frontend ---

    public synchronized Map<String, Object> snapshot() {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("type", "state");
        s.put("grid", grid);
        s.put("active", activeCells());
        s.put("activeColor", current == null ? 0 : current.colorIndex);
        s.put("ghost", ghostCells());
        List<Integer> next = new ArrayList<>();
        for (Tetromino t : queue) next.add(t.colorIndex);
        s.put("next", next.subList(0, Math.min(4, next.size())));
        s.put("hold", hold == null ? 0 : hold.colorIndex);
        s.put("score", score);
        s.put("lines", lines);
        s.put("level", level);
        s.put("running", running);
        s.put("gameOver", gameOver);
        return s;
    }

    public synchronized int getScore() { return score; }
    public synchronized int getLines() { return lines; }
    public synchronized int getLevel() { return level; }
    public synchronized boolean isGameOver() { return gameOver; }
}
