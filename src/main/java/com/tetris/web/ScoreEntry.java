package com.tetris.web;

/** A single leaderboard record. */
public class ScoreEntry {
    private String name;
    private int score;
    private int lines;
    private int level;
    private long timestamp;

    public ScoreEntry() {
    }

    public ScoreEntry(String name, int score, int lines, int level, long timestamp) {
        this.name = name;
        this.score = score;
        this.lines = lines;
        this.level = level;
        this.timestamp = timestamp;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }

    public int getLines() { return lines; }
    public void setLines(int lines) { this.lines = lines; }

    public int getLevel() { return level; }
    public void setLevel(int level) { this.level = level; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}
