// Vercel serverless leaderboard for the client-side build.
// NOTE: storage is in-memory per warm instance, so scores reset on redeploy or
// cold start. For durable storage, swap `scores` for Vercel KV / Postgres.
// The frontend also mirrors scores to localStorage as a per-browser fallback.

const MAX = 20;
let scores = [];

function readJson(req) {
    return new Promise((resolve) => {
        let data = "";
        req.on("data", (c) => { data += c; });
        req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch (e) { resolve({}); } });
        req.on("error", () => resolve({}));
    });
}

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") { res.status(204).end(); return; }

    if (req.method === "POST") {
        let body = req.body;
        if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
        if (!body || typeof body !== "object") body = await readJson(req);

        const entry = {
            name: (String(body.name || "Anonymous").trim().slice(0, 16)) || "Anonymous",
            score: Math.max(0, parseInt(body.score, 10) || 0),
            lines: Math.max(0, parseInt(body.lines, 10) || 0),
            level: Math.max(1, parseInt(body.level, 10) || 1),
            timestamp: Date.now()
        };
        scores.push(entry);
        scores.sort((a, b) => b.score - a.score);
        scores = scores.slice(0, MAX);
    }

    res.status(200).json(scores);
};
