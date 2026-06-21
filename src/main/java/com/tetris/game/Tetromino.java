package com.tetris.game;

/**
 * The seven standard tetrominoes with their four SRS rotation states and
 * Super Rotation System wall-kick tables.
 *
 * Rotation states are stored as occupied cells {row, col} inside a square
 * bounding box (size 4 for I, 2 for O, 3 for the rest). Kick offsets are
 * stored as {dRow, dCol} where row increases downward.
 */
public enum Tetromino {
    I(1, 4, new String[][]{
            {"0000", "1111", "0000", "0000"},
            {"0010", "0010", "0010", "0010"},
            {"0000", "0000", "1111", "0000"},
            {"0100", "0100", "0100", "0100"}
    }),
    O(2, 2, new String[][]{
            {"11", "11"},
            {"11", "11"},
            {"11", "11"},
            {"11", "11"}
    }),
    T(3, 3, new String[][]{
            {"010", "111", "000"},
            {"010", "011", "010"},
            {"000", "111", "010"},
            {"010", "110", "010"}
    }),
    S(4, 3, new String[][]{
            {"011", "110", "000"},
            {"010", "011", "001"},
            {"000", "011", "110"},
            {"100", "110", "010"}
    }),
    Z(5, 3, new String[][]{
            {"110", "011", "000"},
            {"001", "011", "010"},
            {"000", "110", "011"},
            {"010", "110", "100"}
    }),
    J(6, 3, new String[][]{
            {"100", "111", "000"},
            {"011", "010", "010"},
            {"000", "111", "001"},
            {"010", "010", "110"}
    }),
    L(7, 3, new String[][]{
            {"001", "111", "000"},
            {"010", "010", "011"},
            {"000", "111", "100"},
            {"110", "010", "010"}
    });

    /** Color index used by the frontend (1-7). */
    public final int colorIndex;
    public final int boxSize;
    /** cells[rotation] = array of {row, col} occupied within the bounding box. */
    private final int[][][] cells;

    Tetromino(int colorIndex, int boxSize, String[][] shapes) {
        this.colorIndex = colorIndex;
        this.boxSize = boxSize;
        this.cells = new int[4][][];
        for (int r = 0; r < 4; r++) {
            this.cells[r] = parse(shapes[r]);
        }
    }

    private static int[][] parse(String[] rows) {
        java.util.List<int[]> list = new java.util.ArrayList<>();
        for (int r = 0; r < rows.length; r++) {
            for (int c = 0; c < rows[r].length(); c++) {
                if (rows[r].charAt(c) == '1') {
                    list.add(new int[]{r, c});
                }
            }
        }
        return list.toArray(new int[0][]);
    }

    /** Occupied cells {row, col} within the bounding box for the given rotation. */
    public int[][] cells(int rotation) {
        return cells[((rotation % 4) + 4) % 4];
    }

    // --- SRS wall-kick tables, stored as {dRow, dCol} (row increases downward). ---
    // Indexed by transition key fromRot*4 + toRot. Only 90-degree turns are used.

    private static final java.util.Map<Integer, int[][]> JLSTZ_KICKS = new java.util.HashMap<>();
    private static final java.util.Map<Integer, int[][]> I_KICKS = new java.util.HashMap<>();

    static {
        JLSTZ_KICKS.put(key(0, 1), new int[][]{{0, 0}, {0, -1}, {-1, -1}, {2, 0}, {2, -1}});
        JLSTZ_KICKS.put(key(1, 0), new int[][]{{0, 0}, {0, 1}, {1, 1}, {-2, 0}, {-2, 1}});
        JLSTZ_KICKS.put(key(1, 2), new int[][]{{0, 0}, {0, 1}, {1, 1}, {-2, 0}, {-2, 1}});
        JLSTZ_KICKS.put(key(2, 1), new int[][]{{0, 0}, {0, -1}, {-1, -1}, {2, 0}, {2, -1}});
        JLSTZ_KICKS.put(key(2, 3), new int[][]{{0, 0}, {0, 1}, {-1, 1}, {2, 0}, {2, 1}});
        JLSTZ_KICKS.put(key(3, 2), new int[][]{{0, 0}, {0, -1}, {1, -1}, {-2, 0}, {-2, -1}});
        JLSTZ_KICKS.put(key(3, 0), new int[][]{{0, 0}, {0, -1}, {1, -1}, {-2, 0}, {-2, -1}});
        JLSTZ_KICKS.put(key(0, 3), new int[][]{{0, 0}, {0, 1}, {-1, 1}, {2, 0}, {2, 1}});

        I_KICKS.put(key(0, 1), new int[][]{{0, 0}, {0, -2}, {0, 1}, {1, -2}, {-2, 1}});
        I_KICKS.put(key(1, 0), new int[][]{{0, 0}, {0, 2}, {0, -1}, {-1, 2}, {2, -1}});
        I_KICKS.put(key(1, 2), new int[][]{{0, 0}, {0, -1}, {0, 2}, {-2, -1}, {1, 2}});
        I_KICKS.put(key(2, 1), new int[][]{{0, 0}, {0, 1}, {0, -2}, {2, 1}, {-1, -2}});
        I_KICKS.put(key(2, 3), new int[][]{{0, 0}, {0, 2}, {0, -1}, {-1, 2}, {2, -1}});
        I_KICKS.put(key(3, 2), new int[][]{{0, 0}, {0, -2}, {0, 1}, {1, -2}, {-2, 1}});
        I_KICKS.put(key(3, 0), new int[][]{{0, 0}, {0, 1}, {0, -2}, {2, 1}, {-1, -2}});
        I_KICKS.put(key(0, 3), new int[][]{{0, 0}, {0, -1}, {0, 2}, {-2, -1}, {1, 2}});
    }

    private static int key(int from, int to) {
        return from * 4 + to;
    }

    private static final int[][] NO_KICK = new int[][]{{0, 0}};

    /** Wall-kick tests to try, in order, for a rotation from -> to. */
    public int[][] kicks(int from, int to) {
        if (this == O) {
            return NO_KICK;
        }
        java.util.Map<Integer, int[][]> table = (this == I) ? I_KICKS : JLSTZ_KICKS;
        return table.getOrDefault(key(from, to), NO_KICK);
    }
}
