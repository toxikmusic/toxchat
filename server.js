const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const db = new sqlite3.Database('./chat.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Store active usernames
const activeUsernames = new Set();

const updateUserList = () => {
    io.emit('update users', Array.from(activeUsernames));
};

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('set username', (username, callback) => {
        if (activeUsernames.has(username)) {
            callback({ success: false, message: 'Username already taken' });
        } else {
            activeUsernames.add(username);
            socket.username = username;
            callback({ success: true });
            updateUserList();
        }
    });

    socket.on('chat message', (msg) => {
        if (socket.username) {
            db.run(`INSERT INTO messages (username, message) VALUES (?, ?)`, [socket.username, msg], (err) => {
                if (err) {
                    console.error('Error saving message:', err.message);
                } else {
                    io.emit('chat message', { username: socket.username, message: msg });
                }
            });
        }
    });

    db.all(`SELECT username, message, timestamp FROM messages ORDER BY timestamp ASC`, [], (err, rows) => {
        if (!err) {
            socket.emit('load messages', rows);
        }
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            activeUsernames.delete(socket.username);
            updateUserList();
            console.log(`${socket.username} disconnected`);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
