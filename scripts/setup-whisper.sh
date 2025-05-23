#!/bin/bash

# Setup script for whisper.cpp
set -e

WHISPER_DIR="./whisper.cpp"
MODELS_DIR="./models"

echo "Setting up whisper.cpp for local transcription..."

# Create directories
mkdir -p "$MODELS_DIR"

# Clone whisper.cpp if it doesn't exist
if [ ! -d "$WHISPER_DIR" ]; then
    echo "Cloning whisper.cpp..."
    git clone https://github.com/ggml-org/whisper.cpp.git "$WHISPER_DIR"
else
    echo "whisper.cpp already exists, updating..."
    cd "$WHISPER_DIR"
    git pull
    cd ..
fi

# Build whisper.cpp
echo "Building whisper.cpp..."
cd "$WHISPER_DIR"

# Build for the current platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    make clean
    make -j$(sysctl -n hw.ncpu)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    make clean
    make -j$(nproc)
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    echo "For Windows, please use the provided batch script or build manually"
    exit 1
fi

cd ..

# Download base model if it doesn't exist
BASE_MODEL="$MODELS_DIR/ggml-base.bin"
if [ ! -f "$BASE_MODEL" ]; then
    echo "Downloading base Whisper model..."
    cd "$WHISPER_DIR"
    bash ./models/download-ggml-model.sh base
    cd ..
    
    # Move model to our models directory
    mv "$WHISPER_DIR/models/ggml-base.bin" "$BASE_MODEL"
fi

# Download small model if it doesn't exist
SMALL_MODEL="$MODELS_DIR/ggml-small.bin"
if [ ! -f "$SMALL_MODEL" ]; then
    echo "Downloading small Whisper model..."
    cd "$WHISPER_DIR"
    bash ./models/download-ggml-model.sh small
    cd ..
    
    # Move model to our models directory
    mv "$WHISPER_DIR/models/ggml-small.bin" "$SMALL_MODEL"
fi

echo "✅ whisper.cpp setup complete!"
echo "📁 Binary location: $WHISPER_DIR/main"
echo "📁 Models location: $MODELS_DIR"
echo ""
echo "Available models:"
ls -la "$MODELS_DIR"/*.bin 2>/dev/null || echo "No models found"