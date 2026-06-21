package com.tetris.game;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Deterministic checks of the core Tetris rules. Reflection is used to set up
 * specific board/piece scenarios that would be impractical to reach through
 * the random 7-bag during normal play.
 */
class TetrisGameTest {

    private int[][] grid(TetrisGame g) throws Exception {
        Field f = TetrisGame.class.getDeclaredField("grid");
        f.setAccessible(true);
        return (int[][]) f.get(g);
    }

    private void setField(TetrisGame g, String name, Object value) throws Exception {
        Field f = TetrisGame.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(g, value);
    }

    private int intField(TetrisGame g, String name) throws Exception {
        Field f = TetrisGame.class.getDeclaredField(name);
        f.setAccessible(true);
        return f.getInt(g);
    }

    private Object invoke(TetrisGame g, String method, Class<?>[] types, Object... args) throws Exception {
        Method m = TetrisGame.class.getDeclaredMethod(method, types);
        m.setAccessible(true);
        return m.invoke(g, args);
    }

    @Test
    void scoringTableFollowsGuideline() throws Exception {
        TetrisGame g = new TetrisGame();
        g.start();
        setField(g, "score", 0);
        setField(g, "lines", 0);
        setField(g, "level", 1);

        invoke(g, "applyScore", new Class[]{int.class}, 1);
        assertEquals(100, g.getScore());
        assertEquals(1, g.getLines());

        invoke(g, "applyScore", new Class[]{int.class}, 2);
        assertEquals(400, g.getScore()); // 100 + 300

        invoke(g, "applyScore", new Class[]{int.class}, 3);
        assertEquals(900, g.getScore()); // + 500

        invoke(g, "applyScore", new Class[]{int.class}, 4);
        assertEquals(1700, g.getScore()); // + 800
        assertEquals(10, g.getLines());
        assertEquals(2, g.getLevel()); // 10 lines -> level 2
    }

    @Test
    void clearingAFullRowShiftsEverythingDown() throws Exception {
        TetrisGame g = new TetrisGame();
        g.start();
        int[][] grid = grid(g);
        for (int[] row : grid) java.util.Arrays.fill(row, 0);

        // Bottom row full; a single marker block sits directly above it.
        java.util.Arrays.fill(grid[TetrisGame.HEIGHT - 1], 3);
        grid[TetrisGame.HEIGHT - 2][4] = 5;

        int cleared = (int) invoke(g, "clearLines", new Class[]{});
        assertEquals(1, cleared);
        // The marker fell from row HEIGHT-2 into row HEIGHT-1.
        assertEquals(5, grid[TetrisGame.HEIGHT - 1][4]);
        assertEquals(0, grid[TetrisGame.HEIGHT - 2][4]);
    }

    @Test
    void hardDropClearsTwoRowsAndScores() throws Exception {
        TetrisGame g = new TetrisGame();
        g.start();
        int[][] grid = grid(g);
        for (int[] row : grid) java.util.Arrays.fill(row, 0);
        setField(g, "score", 0);
        setField(g, "lines", 0);
        setField(g, "level", 1);

        // Fill the bottom two rows except the right-most two columns.
        for (int c = 0; c < 8; c++) {
            grid[TetrisGame.HEIGHT - 1][c] = 1;
            grid[TetrisGame.HEIGHT - 2][c] = 1;
        }

        // Place an O piece above columns 8-9 and slam it down to complete both rows.
        setField(g, "current", Tetromino.O);
        setField(g, "rot", 0);
        setField(g, "row", 0);
        setField(g, "col", 8);

        g.hardDrop();

        assertEquals(2, g.getLines());
        // O drops from row 0 to row HEIGHT-2 = 18 rows -> 36 hard-drop points, + 300 for a double.
        assertEquals(36 + 300, g.getScore());
        // Both completed rows were cleared, leaving an empty board.
        for (int[] row : grid) {
            for (int cell : row) {
                assertEquals(0, cell);
            }
        }
    }

    @Test
    void spawningIntoBlocksEndsTheGame() throws Exception {
        TetrisGame g = new TetrisGame();
        g.start();
        assertFalse(g.isGameOver());

        int[][] grid = grid(g);
        java.util.Arrays.fill(grid[0], 2);
        java.util.Arrays.fill(grid[1], 2);

        invoke(g, "spawn", new Class[]{});
        assertTrue(g.isGameOver());
    }

    @Test
    void fourClockwiseRotationsReturnToStart() throws Exception {
        TetrisGame g = new TetrisGame();
        g.start();
        int[][] grid = grid(g);
        for (int[] row : grid) java.util.Arrays.fill(row, 0);

        // T piece in open space rotates freely with no wall kicks.
        setField(g, "current", Tetromino.T);
        setField(g, "rot", 0);
        setField(g, "row", 8);
        setField(g, "col", 4);

        for (int i = 0; i < 4; i++) g.rotate(true);

        assertEquals(0, intField(g, "rot"));
        assertEquals(8, intField(g, "row"));
        assertEquals(4, intField(g, "col"));
    }
}
