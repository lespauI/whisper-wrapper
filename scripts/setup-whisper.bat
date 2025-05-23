@echo off
setlocal enabledelayedexpansion

echo Setting up whisper.cpp for local transcription...

set WHISPER_DIR=whisper.cpp
set MODELS_DIR=models

:: Create directories
if not exist "%MODELS_DIR%" mkdir "%MODELS_DIR%"

:: Clone whisper.cpp if it doesn't exist
if not exist "%WHISPER_DIR%" (
    echo Cloning whisper.cpp...
    git clone https://github.com/ggml-org/whisper.cpp.git "%WHISPER_DIR%"
) else (
    echo whisper.cpp already exists, updating...
    cd "%WHISPER_DIR%"
    git pull
    cd ..
)

:: Build whisper.cpp
echo Building whisper.cpp...
cd "%WHISPER_DIR%"

:: Check if we have Visual Studio build tools or use make
where cl >nul 2>nul
if %errorlevel% == 0 (
    echo Building with Visual Studio...
    mkdir build 2>nul
    cd build
    cmake ..
    cmake --build . --config Release
    cd ..
) else (
    echo Building with make...
    make clean
    make
)

cd ..

:: Download base model if it doesn't exist
set BASE_MODEL=%MODELS_DIR%\ggml-base.bin
if not exist "%BASE_MODEL%" (
    echo Downloading base Whisper model...
    cd "%WHISPER_DIR%"
    call models\download-ggml-model.cmd base
    cd ..
    
    :: Move model to our models directory
    move "%WHISPER_DIR%\models\ggml-base.bin" "%BASE_MODEL%"
)

:: Download small model if it doesn't exist
set SMALL_MODEL=%MODELS_DIR%\ggml-small.bin
if not exist "%SMALL_MODEL%" (
    echo Downloading small Whisper model...
    cd "%WHISPER_DIR%"
    call models\download-ggml-model.cmd small
    cd ..
    
    :: Move model to our models directory
    move "%WHISPER_DIR%\models\ggml-small.bin" "%SMALL_MODEL%"
)

echo.
echo ✅ whisper.cpp setup complete!
echo 📁 Binary location: %WHISPER_DIR%\main.exe (or %WHISPER_DIR%\build\bin\Release\main.exe)
echo 📁 Models location: %MODELS_DIR%
echo.
echo Available models:
dir "%MODELS_DIR%\*.bin" 2>nul || echo No models found

pause