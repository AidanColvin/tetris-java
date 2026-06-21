package com.tetris.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tetris.game.TetrisGame;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Owns one player's game: a {@link TetrisGame} plus the gravity loop that
 * advances it. All mutation goes through the game instance's monitor so the
 * scheduler thread and the WebSocket I/O thread never race.
 */
public class GameSession {

    private static final long TICK_MS = 30;

    private final WebSocketSession socket;
    private final ObjectMapper mapper;
    private final TetrisGame game = new TetrisGame();

    private ScheduledFuture<?> tickTask;
    private long lastTickAt;

    public GameSession(WebSocketSession socket, ObjectMapper mapper) {
        this.socket = socket;
        this.mapper = mapper;
    }

    public void startLoop(ScheduledExecutorService scheduler) {
        lastTickAt = System.currentTimeMillis();
        tickTask = scheduler.scheduleAtFixedRate(this::onTick, TICK_MS, TICK_MS, TimeUnit.MILLISECONDS);
    }

    private void onTick() {
        long now = System.currentTimeMillis();
        long elapsed = now - lastTickAt;
        lastTickAt = now;
        boolean changed;
        synchronized (game) {
            changed = game.tick(elapsed);
        }
        if (changed) {
            sendState();
        }
    }

    public void startGame() {
        synchronized (game) {
            game.start();
        }
        sendState();
    }

    public void input(String action) {
        synchronized (game) {
            switch (action) {
                case "left" -> game.moveLeft();
                case "right" -> game.moveRight();
                case "softDrop" -> game.softDrop();
                case "hardDrop" -> game.hardDrop();
                case "rotateCW" -> game.rotate(true);
                case "rotateCCW" -> game.rotate(false);
                case "hold" -> game.hold();
                default -> { /* ignore unknown actions */ }
            }
        }
        sendState();
    }

    public void sendState() {
        try {
            Object snapshot;
            synchronized (game) {
                snapshot = game.snapshot();
            }
            String json = mapper.writeValueAsString(snapshot);
            synchronized (socket) {
                if (socket.isOpen()) {
                    socket.sendMessage(new TextMessage(json));
                }
            }
        } catch (IOException e) {
            // Client likely disconnected; the handler will clean up.
        }
    }

    public TetrisGame getGame() {
        return game;
    }

    public void stop() {
        if (tickTask != null) {
            tickTask.cancel(false);
        }
    }
}
