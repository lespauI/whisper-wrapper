const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from the renderer dist directory (built files)
app.use(express.static(path.join(__dirname, '../src/renderer/dist')));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../src/renderer/dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Renderer server running on http://localhost:${PORT}`);
});