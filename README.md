# Tetris — Java Edition

An online Tetris where **the entire game engine runs in Java**. A Spring Boot
backend holds the authoritative game state (board, SRS rotation, line clears,
scoring, gravity, 7-bag, hold, hard drop) and streams it to the browser over a
WebSocket. The browser only renders state and forwards keystrokes.

## Architecture

```
Browser (HTML5 Canvas + JS)  <->  WebSocket /ws/game  <->  Spring Boot
   renders state, sends keys         JSON state msgs        TetrisGame engine (Java)
                                 <->  REST /api/leaderboard <->  file-persisted scores
```

- **Backend** — Spring Boot 3 (Java 17). `com.tetris.game.*` is the engine;
  `com.tetris.web.*` is the WebSocket + leaderboard REST layer.
- **Frontend** — static `index.html` / `style.css` / `game.js`, served by Spring Boot.
- One authoritative game per connected browser; gravity advances on the server.

## Run locally

```bash
mvn spring-boot:run
# or build a jar:
mvn clean package
java -jar target/tetris.jar
```

Then open http://localhost:8080.

## Controls

| Key | Action |
| --- | --- |
| Left / Right | Move |
| Down | Soft drop |
| Up / X | Rotate CW |
| Z | Rotate CCW |
| Space | Hard drop |
| C | Hold |

## Deploy (public URL)

This repo ships **two deploy targets**:

1. **Render — the real Java backend (`Dockerfile` + `render.yaml`).**
   The full server-authoritative game: Spring Boot process with a long-lived
   WebSocket serving the Java engine. Needs a JVM/Docker host (Vercel's
   serverless model can't run it). Works as-is on Render, Railway, or Fly.io;
   hosts inject `PORT`, which `application.properties` honors.

2. **Vercel — a client-side build (`public/` + `api/` + `vercel.json`).**
   The same Tetris rules ported to browser JavaScript (`public/game.js`) so the
   game runs entirely client-side and can be hosted statically. The leaderboard
   is a Vercel serverless function (`api/leaderboard.js`, in-memory; mirrored to
   `localStorage` per browser). This is the standalone version — the connected
   Java backend lives on the Render target above.
