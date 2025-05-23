# Local Whisper Setup Guide

This guide will help you set up local Whisper processing for the Whisper Wrapper application.

## Overview

The Whisper Wrapper now uses **local Whisper processing** instead of the OpenAI API. This means:
- ✅ No internet connection required for transcription
- ✅ No API keys needed
- ✅ Complete privacy - your audio never leaves your computer
- ✅ No usage limits or costs

## Prerequisites

### macOS
- Xcode Command Line Tools: `xcode-select --install`
- Git (usually included with Xcode tools)

### Linux
- Build essentials: `sudo apt-get install build-essential git`
- Or equivalent for your distribution

### Windows
- Git for Windows
- Visual Studio Build Tools or Visual Studio Community
- Or MinGW-w64/MSYS2

## Setup Instructions

### 1. Run the Setup Script

Navigate to your project directory and run the appropriate setup script:

#### macOS/Linux:
```bash
chmod +x scripts/setup-whisper.sh
./scripts/setup-whisper.sh
```

#### Windows:
```cmd
scripts\setup-whisper.bat
```

### 2. What the Script Does

The setup script will:
1. Clone the whisper.cpp repository
2. Build the whisper.cpp binary for your platform
3. Download the base and small Whisper models
4. Set up the directory structure

### 3. Manual Setup (Alternative)

If the script doesn't work, you can set up manually:

```bash
# Clone whisper.cpp
git clone https://github.com/ggml-org/whisper.cpp.git

# Build whisper.cpp
cd whisper.cpp
make -j$(nproc)  # Linux
make -j$(sysctl -n hw.ncpu)  # macOS

# Download models
bash ./models/download-ggml-model.sh base
bash ./models/download-ggml-model.sh small

# Move models to project root
cd ..
mkdir -p models
mv whisper.cpp/models/ggml-*.bin models/
```

## Available Models

| Model | Size | Memory | Speed | Quality |
|-------|------|--------|-------|---------|
| tiny | 39 MB | ~125 MB | ~32x | Good |
| base | 74 MB | ~210 MB | ~16x | Better |
| small | 244 MB | ~550 MB | ~6x | Good |
| medium | 769 MB | ~1.5 GB | ~2x | Very Good |
| large | 1550 MB | ~2.9 GB | ~1x | Best |

## Directory Structure

After setup, your project should look like this:

```
whisper-wrapper/
├── whisper.cpp/           # whisper.cpp repository
│   ├── main               # whisper.cpp binary (macOS/Linux)
│   ├── main.exe           # whisper.cpp binary (Windows)
│   └── ...
├── models/                # Whisper models
│   ├── ggml-base.bin
│   ├── ggml-small.bin
│   └── ...
├── scripts/               # Setup scripts
│   ├── setup-whisper.sh
│   └── setup-whisper.bat
└── ...
```

## Testing the Setup

1. Start the Whisper Wrapper application: `npm start`
2. Open Settings (gear icon)
3. Check the "Local Whisper Status" - it should show "Local Whisper is ready"
4. Select your preferred model and settings
5. Try transcribing an audio file or recording

## Troubleshooting

### "whisper.cpp binary not found"
- Make sure the setup script completed successfully
- Check that `whisper.cpp/main` (or `main.exe` on Windows) exists
- Try rebuilding: `cd whisper.cpp && make clean && make`

### "No Whisper models found"
- Ensure models are in the `models/` directory
- Re-run the model download: `cd whisper.cpp && bash ./models/download-ggml-model.sh base`

### Build errors on Windows
- Install Visual Studio Build Tools
- Or use the Windows Subsystem for Linux (WSL)

### Permission errors on macOS/Linux
- Make sure the setup script is executable: `chmod +x scripts/setup-whisper.sh`
- You might need to allow the binary in System Preferences > Security & Privacy

## Performance Tips

1. **Choose the right model**: Start with 'base' for good speed/quality balance
2. **Adjust threads**: Use more threads on multi-core systems (Settings > Processing Threads)
3. **Audio format**: WAV files typically process faster than compressed formats
4. **File size**: Smaller audio files process faster

## Model Recommendations

- **For quick testing**: tiny or base
- **For general use**: base or small
- **For high accuracy**: medium or large
- **For production**: small or medium (good balance)

## Support

If you encounter issues:
1. Check the console output for error messages
2. Verify your system meets the prerequisites
3. Try the manual setup steps
4. Check the whisper.cpp repository for platform-specific issues

## Privacy & Security

With local Whisper processing:
- Your audio files never leave your computer
- No data is sent to external servers
- No API keys or accounts required
- Complete offline operation