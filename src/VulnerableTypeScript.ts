import express from "express";
import fs from "fs";
import sqlite3 from "sqlite3";

const app = express();
const db = new sqlite3.Database(":memory:");

app.use(express.json());

// ❌ No authentication / authorization
app.get("/user", (req, res) => {
    const username = req.query.username as string;

    // ❌ SQL Injection
    const query = `SELECT Id, Name, Password FROM users WHERE username = '${username}'`;

    db.all(query, [], (err, rows) => {
        if (err) {
            // ❌ Information disclosure
            return res.send(err.message);
        }

        // ❌ Reflected XSS
        res.send(`
            <h1>Results</h1>
            <p>You searched for: ${username}</p>
            <pre>${JSON.stringify(rows)}</pre>
        `);
    });
});

// ❌ Command Injection
app.get("/ping", (req, res) => {
    const host = req.query.host as string;
    require("child_process").exec(`ping -c 1 ${host}`, (err: any, stdout: any) => {
        res.send(stdout);
    });
});

// ❌ Path Traversal
app.get("/file", (req, res) => {
    const file = req.query.name as string;
    const content = fs.readFileSync(`./data/${file}`, "utf-8");
    res.send(content);
});

// ❌ Insecure deserialization (example)
app.post("/deserialize", (req, res) => {
    const obj = JSON.parse(req.body.data); // no validation
    res.send(obj);
});

// ❌ Hardcoded secret
const SECRET = "supersecretkey";

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
