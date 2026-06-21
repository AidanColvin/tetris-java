package com.tetris.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

/**
 * Routes WebSocket messages to the matching {@link GameSession}. Each connected
 * browser gets its own authoritative game running on the shared scheduler.
 */
@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, GameSession> sessions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler =
            Executors.newScheduledThreadPool(Math.max(2, Runtime.getRuntime().availableProcessors()));

    @Override
    public void afterConnectionEstablished(WebSocketSession socket) {
        GameSession session = new GameSession(socket, mapper);
        sessions.put(socket.getId(), session);
        session.startLoop(scheduler);
        session.sendState();
    }

    @Override
    protected void handleTextMessage(WebSocketSession socket, TextMessage message) throws Exception {
        GameSession session = sessions.get(socket.getId());
        if (session == null) return;
        JsonNode node = mapper.readTree(message.getPayload());
        String type = node.path("type").asText("");
        switch (type) {
            case "start" -> session.startGame();
            case "input" -> session.input(node.path("action").asText(""));
            default -> { /* ignore */ }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession socket, CloseStatus status) {
        GameSession session = sessions.remove(socket.getId());
        if (session != null) {
            session.stop();
        }
    }
}
