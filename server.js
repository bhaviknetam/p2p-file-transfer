const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const User = require('./database');
const websocketServer = require('./websocket');
const secret = crypto.randomBytes(64).toString('hex');

const app = express();

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Register endpoint
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).send('Username already exists');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();
        res.status(201).send('User registered');
    } catch (error) {
        console.error('Registration failed:', error);
        res.status(500).send('Registration failed');
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
        return res.status(400).send('User not found');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(400).send('Invalid password');
    }
    const token = jwt.sign({ userId: user._id }, secret);
    res.send({ token });
});

app.get('/share', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

// Fetch user details endpoint 
app.get('/user', async (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.userId);
    res.send({ username: user.username });
});

// Change password endpoint
app.post('/change_password', async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, secret);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(400).send('User not found');
        }
        const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).send('Invalid old password');
        }
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.send('Password changed successfully');
    } catch (error) {
        console.error('Password change failed:', error);
        res.status(500).send('Password change failed');
    }
});


// Serve the login and signup pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login', (req, res) => {
    res.redirect('/');
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

const server = app.listen(3000, () => {
    console.log('HTTP server is running on port 3000');
});

server.on('upgrade', (request, socket, head) => {
    websocketServer.handleUpgrade(request, socket, head, (ws) => {
        websocketServer.emit('connection', ws, request);
    });
});
