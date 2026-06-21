# Tetris

A full game of Tetris whose **rules engine is written in Java** — board, SRS
rotation with wall kicks, 7‑bag randomizer, line clears, guideline scoring,
gravity, hold and hard drop.

It ships in **two forms** from one repo:

- **Render** — the authoritative Java engine runs server‑side; the browser is a
  thin client over a WebSocket.
- **Vercel** — the same rules ported to browser JavaScript so the game runs
  client‑side and hosts statically.

**▶ Live (Vercel build):** https://tetris-java.vercel.app

---

## The two builds at a glance

```mermaid
flowchart LR
    subgraph C["Browser"]
      UI["Canvas UI<br/>keyboard · touch · swipe"]
    end

    subgraph R["Render — Spring Boot (Java)"]
      direction TB
      WS["WebSocket /ws/game"]
      SES["GameSession<br/>gravity scheduler"]
      ENG["TetrisGame engine (Java)"]
      REST["REST /api/leaderboard"]
      FILE["data/leaderboard.json"]
      WS --> SES --> ENG
      REST --> FILE
    end

    subgraph V["Vercel — static + serverless"]
      direction TB
      PUB["public/ static assets"]
      JENG["TetrisGame engine (JS port)<br/>runs in the browser"]
      FN["api/leaderboard.js<br/>serverless function"]
      PUB --> JENG
    end

    UI <==>|"WS JSON state"| WS
    UI -->|"GET/POST"| REST
    UI ==>|"HTTP"| PUB
    UI -->|"GET/POST"| FN
```

| | Render build | Vercel build |
| --- | --- | --- |
| Where the game runs | **Server** (Java, authoritative) | **Browser** (JS port) |
| Transport | WebSocket `/ws/game` | none — local |
| Leaderboard | Spring REST → JSON file | serverless fn + `localStorage` |
| Source | `src/`, `Dockerfile`, `render.yaml` | `public/`, `api/`, `vercel.json` |
| Host needs | a JVM / Docker host | any static host |

---

## Render build — server‑authoritative Java

The server owns the game. Each connected browser gets its own `TetrisGame`, and
a scheduler advances gravity ~30 ms and broadcasts the state; the browser only
renders snapshots and forwards key/touch actions.

```mermaid
sequenceDiagram
    participant U as Browser
    participant H as GameWebSocketHandler
    participant S as GameSession
    participant E as TetrisGame (Java)

    U->>H: { type:"input", action:"left" }
    H->>S: input("left")
    S->>E: moveLeft()
    E-->>S: snapshot
    S-->>U: state (JSON)

    loop every ~30 ms
        S->>E: tick(elapsed)
        E-->>S: gravity step / lock / clear
        S-->>U: state (JSON)
    end
```

---

## Vercel build — client‑side JS

A faithful port of the Java engine (`public/game.js`) runs entirely in the
browser, so the playable game is just static files. The leaderboard is a small
serverless function, with `localStorage` as a per‑browser fallback.

```mermaid
flowchart TD
    B["Browser"]
    subgraph V["Vercel"]
      PUB["public/<br/>index.html · style.css · game.js"]
      JS["TetrisGame engine (JS)<br/>+ Canvas rendering"]
      FN["api/leaderboard.js"]
    end
    B -->|"HTTP"| PUB --> JS
    B -->|"GET/POST /api/leaderboard"| FN
    JS -. "fallback when offline" .-> LS["localStorage"]
```

---

## The engine (shared rules)

Both builds implement the same pipeline. In Java it lives in
`com.tetris.game.TetrisGame`; the JS port mirrors it method‑for‑method.

```mermaid
flowchart LR
    Spawn["spawn()<br/>7‑bag piece at top"] --> Active(["Active piece"])
    Active -->|"move / rotate<br/>(SRS wall kicks)"| Active
    Active -->|"gravity tick<br/>or soft drop"| Q{"can move<br/>down?"}
    Q -->|"yes"| Active
    Q -->|"no"| Lock["lockPiece()"]
    Active -->|"hard drop"| Lock
    Lock --> Clear["clearLines()"]
    Clear --> Score["applyScore()<br/>100 / 300 / 500 / 800 × level"]
    Score --> Spawn
    Spawn -->|"collides at spawn"| Over(["Game over"])
```

Game states:

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> Running: Start
    Running --> Running: move · rotate · drop · line clear
    Running --> GameOver: top out
    GameOver --> Running: Play again
```

---

## Repository layout

```
tetris-java/
├── src/main/java/com/tetris/
│   ├── TetrisApplication.java         Spring Boot entry point
│   ├── game/
│   │   ├── Tetromino.java             7 pieces · SRS states · wall-kick tables
│   │   └── TetrisGame.java            authoritative engine (rules + scoring)
│   └── web/
│       ├── WebSocketConfig.java       registers /ws/game
│       ├── GameWebSocketHandler.java  routes messages → sessions
│       ├── GameSession.java           per-player game + gravity loop
│       ├── Leaderboard.java           file-persisted top scores
│       ├── LeaderboardController.java REST /api/leaderboard
│       └── ScoreEntry.java
├── src/main/resources/
│   ├── static/                        Render frontend (served by Spring Boot)
│   └── application.properties         reads ${PORT:8080}
├── src/test/java/com/tetris/game/
│   └── TetrisGameTest.java            line clears · scoring · rotation · game over
├── public/                            Vercel client build (HTML/CSS/JS engine)
├── api/leaderboard.js                 Vercel serverless leaderboard
├── vercel.json · .vercelignore        Vercel config
├── Dockerfile · render.yaml           Render config
└── pom.xml
```

---

## Run locally

**Java backend (full server-authoritative game):**

```bash
mvn spring-boot:run
# or: mvn clean package && java -jar target/tetris.jar
```
Open http://localhost:8080.

**Vercel client build (static):**

```bash
python3 -m http.server 4000 --directory public
```
Open http://localhost:4000 (the leaderboard falls back to `localStorage` without the serverless function).

---

## Controls

| Key | Action | | Touch |
| --- | --- | --- | --- |
| ← / → | Move | | on‑screen ◀ ▶ or swipe |
| ↓ | Soft drop | | ▼ button or swipe down |
| ↑ / X | Rotate CW | | ⟳ button or tap board |
| Z | Rotate CCW | | — |
| Space | Hard drop | | ⤓ button or flick down |
| C | Hold | | hold button |

The UI is responsive (iPhone / iPad / desktop), follows system light/dark, and
shows on‑screen controls on touch devices.

---

## Tests

```bash
mvn test
```
`TetrisGameTest` covers the core rules deterministically: single/double line
clears and row shifting, the 100/300/500/800 scoring table and level‑up, game
over on spawn collision, and rotation.

---

## Deploy

```mermaid
flowchart LR
    Repo["GitHub: AidanColvin/tetris-java"]
    Repo -->|"Dockerfile + render.yaml"| Render["Render<br/>Java + WebSocket<br/>(stable URL)"]
    Repo -->|"vercel.json (static + api)"| Vercel["Vercel<br/>client build<br/>tetris-java.vercel.app"]
```

- **Render** — `Dockerfile` + `render.yaml` blueprint. Works as‑is on any
  JVM/Docker host (Render, Railway, Fly.io); the host injects `PORT`.
- **Vercel** — `vercel --prod` deploys `public/` as static plus `api/` as
  serverless functions.
