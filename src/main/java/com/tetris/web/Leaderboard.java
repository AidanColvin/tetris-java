package com.tetris.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * In-memory leaderboard persisted to a JSON file so scores survive restarts.
 * Keeps the top {@value #MAX_ENTRIES} results.
 */
@Service
public class Leaderboard {

    private static final int MAX_ENTRIES = 20;
    private final File store = new File("data/leaderboard.json");
    private final ObjectMapper mapper = new ObjectMapper();
    private final List<ScoreEntry> entries = new ArrayList<>();

    @PostConstruct
    public synchronized void load() {
        if (store.exists()) {
            try {
                ScoreEntry[] loaded = mapper.readValue(store, ScoreEntry[].class);
                entries.addAll(List.of(loaded));
                sortAndTrim();
            } catch (IOException e) {
                // Corrupt or unreadable file: start fresh rather than crash.
            }
        }
    }

    public synchronized List<ScoreEntry> top() {
        return new ArrayList<>(entries);
    }

    public synchronized List<ScoreEntry> add(ScoreEntry entry) {
        if (entry.getName() == null || entry.getName().isBlank()) {
            entry.setName("Anonymous");
        }
        entry.setName(entry.getName().trim());
        if (entry.getName().length() > 16) {
            entry.setName(entry.getName().substring(0, 16));
        }
        if (entry.getTimestamp() == 0) {
            entry.setTimestamp(System.currentTimeMillis());
        }
        entries.add(entry);
        sortAndTrim();
        save();
        return new ArrayList<>(entries);
    }

    private void sortAndTrim() {
        entries.sort(Comparator.comparingInt(ScoreEntry::getScore).reversed());
        while (entries.size() > MAX_ENTRIES) {
            entries.remove(entries.size() - 1);
        }
    }

    private void save() {
        try {
            File dir = store.getParentFile();
            if (dir != null && !dir.exists()) {
                dir.mkdirs();
            }
            mapper.writerWithDefaultPrettyPrinter().writeValue(store, entries);
        } catch (IOException e) {
            // Non-fatal: leaderboard simply won't persist this run.
        }
    }
}
