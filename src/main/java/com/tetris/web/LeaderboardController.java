package com.tetris.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/leaderboard")
public class LeaderboardController {

    private final Leaderboard leaderboard;

    public LeaderboardController(Leaderboard leaderboard) {
        this.leaderboard = leaderboard;
    }

    @GetMapping
    public List<ScoreEntry> top() {
        return leaderboard.top();
    }

    @PostMapping
    public ResponseEntity<List<ScoreEntry>> submit(@RequestBody ScoreEntry entry) {
        // Clamp obviously invalid scores; the engine is authoritative for real play.
        if (entry.getScore() < 0) entry.setScore(0);
        if (entry.getLines() < 0) entry.setLines(0);
        if (entry.getLevel() < 1) entry.setLevel(1);
        return ResponseEntity.ok(leaderboard.add(entry));
    }
}
