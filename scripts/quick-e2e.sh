#!/bin/bash

# Quick E2E Testing Script
# A simple bash script for quick E2E testing

echo "🚀 Quick E2E Testing Setup"
echo "=========================="

# Build the renderer
echo "📦 Building renderer..."
npm run build:renderer

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build completed!"

# Set production environment and start
echo "🎯 Starting app in production mode..."
NODE_ENV=production npm run start:electron