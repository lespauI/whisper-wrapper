#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/tests/fixtures/audio"
mkdir -p "$OUT_DIR"

echo "🔎 Looking for ffmpeg..."

# Try node ffmpeg-static
FFMPEG_BIN=""
if command -v node >/dev/null 2>&1; then
  set +e
  FFMPEG_BIN=$(node -e "try{console.log(require('ffmpeg-static')||'')}catch(e){process.exit(0)}")
  set -e
fi

if [[ -n "$FFMPEG_BIN" && -x "$FFMPEG_BIN" ]]; then
  echo "✅ Using ffmpeg-static: $FFMPEG_BIN"
else
  if command -v ffmpeg >/dev/null 2>&1; then
    FFMPEG_BIN=$(command -v ffmpeg)
    echo "✅ Using system ffmpeg: $FFMPEG_BIN"
  else
    echo "❌ ffmpeg not found. Install ffmpeg or add ffmpeg-static to dependencies."
    exit 1
  fi
fi

cd "$OUT_DIR"

echo "🎧 Generating 5s 16kHz mono fixtures in $OUT_DIR ..."

# Silence 5s
"$FFMPEG_BIN" -hide_banner -loglevel error -f lavfi -i anullsrc=r=16000:cl=mono -t 5 -acodec pcm_s16le -ac 1 -ar 16000 silence_5s.wav -y
echo "✅ silence_5s.wav"

# Tone 5s @ 440Hz
"$FFMPEG_BIN" -hide_banner -loglevel error -f lavfi -i sine=frequency=440:sample_rate=16000:duration=5 -acodec pcm_s16le -ac 1 -ar 16000 tone_5s.wav -y
echo "✅ tone_5s.wav"

# Noise 5s (pink noise)
"$FFMPEG_BIN" -hide_banner -loglevel error -f lavfi -i anoisesrc=c=pink:r=16000:d=5 -acodec pcm_s16le -ac 1 -ar 16000 noise_5s.wav -y || {
  echo "ℹ️ anoisesrc not available; generating white noise via aevalsrc"
  "$FFMPEG_BIN" -hide_banner -loglevel error -f lavfi -i aevalsrc=exprs='random(0)':s=16000:d=5 -acodec pcm_s16le -ac 1 -ar 16000 noise_5s.wav -y
}
echo "✅ noise_5s.wav"

# Mixed 7s: 2s silence + 3s tone + 2s silence (helps later verification)
"$FFMPEG_BIN" -hide_banner -loglevel error -f lavfi -i anullsrc=r=16000:cl=mono -t 2 -acodec pcm_s16le -ac 1 -ar 16000 silence_2s.wav -y
"$FFMPEG_BIN" -hide_banner -loglevel error -f lavfi -i sine=frequency=440:sample_rate=16000:duration=3 -acodec pcm_s16le -ac 1 -ar 16000 tone_3s.wav -y
printf "file 'silence_2s.wav'\nfile 'tone_3s.wav'\nfile 'silence_2s.wav'\n" > concat_list.txt
"$FFMPEG_BIN" -hide_banner -loglevel error -f concat -safe 0 -i concat_list.txt -c copy mixed_silence_tone_silence_7s.wav -y
rm -f concat_list.txt silence_2s.wav tone_3s.wav
echo "✅ mixed_silence_tone_silence_7s.wav"

echo "✨ Fixtures generated."

