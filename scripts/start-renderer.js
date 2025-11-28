const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Prefer serving from src during development; fall back to dist if present/forced
const srcRoot = path.join(__dirname, '../src/renderer');
const distRoot = path.join(__dirname, '../src/renderer/dist');
const useDist = process.env.USE_DIST === '1' || (fs.existsSync(distRoot) && fs.existsSync(path.join(distRoot, 'index.html')));
const root = useDist ? distRoot : srcRoot;

app.use(express.static(root));

app.get('/', (req, res) => {
    res.sendFile(path.join(root, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Renderer server running on http://localhost:${PORT}`);
    console.log(`Serving renderer from: ${root}`);
});
