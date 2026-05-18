const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Always serve from src in dev so source-level changes (e.g. controller fixes)
// take effect immediately. A stale `src/renderer/dist` from a previous build
// would otherwise silently shadow source changes. Set USE_DIST=1 to opt in to
// the built bundle for prod-like testing.
const srcRoot = path.join(__dirname, '../src/renderer');
const distRoot = path.join(__dirname, '../src/renderer/dist');
const distHasIndex = fs.existsSync(distRoot) && fs.existsSync(path.join(distRoot, 'index.html'));
const useDist = process.env.USE_DIST === '1' && distHasIndex;
const root = useDist ? distRoot : srcRoot;

app.use(express.static(root));

app.get('/', (req, res) => {
    res.sendFile(path.join(root, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Renderer server running on http://localhost:${PORT}`);
    console.log(`Serving renderer from: ${root}`);
});
