const fs = require('fs');
const path = require('path');

// Simple build script that copies renderer files to dist
const srcDir = path.join(__dirname, '../src/renderer');
const distDir = path.join(__dirname, '../src/renderer/dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy files
function copyFile(src, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
}

// Copy HTML
copyFile(
    path.join(srcDir, 'index.html'),
    path.join(distDir, 'index.html')
);

// Copy JS
copyFile(
    path.join(srcDir, 'index.js'),
    path.join(distDir, 'index.js')
);

// Copy CSS
const stylesDir = path.join(distDir, 'styles');
if (!fs.existsSync(stylesDir)) {
    fs.mkdirSync(stylesDir, { recursive: true });
}

copyFile(
    path.join(srcDir, 'styles/main.css'),
    path.join(stylesDir, 'main.css')
);

console.log('Renderer build completed successfully!');