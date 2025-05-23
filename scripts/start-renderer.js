const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from the renderer directory
app.use(express.static(path.join(__dirname, '../src/renderer')));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../src/renderer/index.html'));
});

app.listen(PORT, () => {
    console.log(`Renderer server running on http://localhost:${PORT}`);
});