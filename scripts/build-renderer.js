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

// Copy directory recursively
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            copyFile(srcPath, destPath);
        }
    }
}

// Copy HTML
copyFile(
    path.join(srcDir, 'index.html'),
    path.join(distDir, 'index.html')
);

// Copy all JS files in root
const jsFiles = ['index.js', 'index_new.js', 'index_test.js', 'new_index.js'];
jsFiles.forEach(jsFile => {
    const srcPath = path.join(srcDir, jsFile);
    if (fs.existsSync(srcPath)) {
        copyFile(srcPath, path.join(distDir, jsFile));
    }
});

// Copy entire app directory (App.js, AppState.js, etc.)
const appSrcDir = path.join(srcDir, 'app');
const appDestDir = path.join(distDir, 'app');
if (fs.existsSync(appSrcDir)) {
    copyDirectory(appSrcDir, appDestDir);
    console.log('✅ Copied app/ directory');
}

// Copy entire utils directory (Constants.js, UIHelpers.js, EventHandler.js, etc.)
const utilsSrcDir = path.join(srcDir, 'utils');
const utilsDestDir = path.join(distDir, 'utils');
if (fs.existsSync(utilsSrcDir)) {
    copyDirectory(utilsSrcDir, utilsDestDir);
    console.log('✅ Copied utils/ directory');
}

// Copy all controllers
const controllersSrcDir = path.join(srcDir, 'controllers');
const controllersDestDir = path.join(distDir, 'controllers');
if (fs.existsSync(controllersSrcDir)) {
    copyDirectory(controllersSrcDir, controllersDestDir);
    console.log('✅ Copied controllers/ directory');
}

// Copy entire styles directory
const stylesSrcDir = path.join(srcDir, 'styles');
const stylesDestDir = path.join(distDir, 'styles');
if (fs.existsSync(stylesSrcDir)) {
    copyDirectory(stylesSrcDir, stylesDestDir);
    console.log('✅ Copied styles/ directory');
}

// Copy assets if they exist
const assetsSrcDir = path.join(srcDir, 'assets');
const assetsDestDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsSrcDir)) {
    copyDirectory(assetsSrcDir, assetsDestDir);
    console.log('✅ Copied assets/ directory');
}

console.log('🚀 Renderer build completed successfully!');