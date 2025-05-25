# E2E Testing Guide

This guide explains how to run the Whisper Wrapper application in a production-like environment for end-to-end testing.

## Available Scripts

### 1. Full E2E Testing Environment
```bash
npm run start:e2e
```

**What it does:**
- ✅ Cleans previous builds
- ✅ Builds all renderer files
- ✅ Verifies build output
- ✅ Checks Whisper setup
- ✅ Sets production environment
- ✅ Starts app with built files
- ✅ Provides testing tips

**Best for:** Comprehensive testing, CI/CD, thorough validation

### 2. Quick E2E Testing
```bash
npm run start:e2e:quick
```

**What it does:**
- ✅ Builds renderer files
- ✅ Starts app in production mode

**Best for:** Quick testing during development

### 3. Production Mode
```bash
npm run start:prod
```

**What it does:**
- ✅ Builds renderer files
- ✅ Starts app with NODE_ENV=production

**Best for:** Testing production behavior

## Why Use E2E Scripts?

### Development vs E2E Testing

| Aspect | Development (`npm start`) | E2E Testing (`npm run start:e2e`) |
|--------|---------------------------|-----------------------------------|
| **Files Used** | Source files (`src/renderer/`) | Built files (`src/renderer/dist/`) |
| **Environment** | Development | Production-like |
| **Hot Reload** | ✅ Yes | ❌ No |
| **Build Process** | ❌ Skipped | ✅ Full build |
| **Testing Accuracy** | ⚠️ May differ from production | ✅ Matches production |

### What Gets Tested

When you use E2E scripts, you're testing:

1. **Built Files**: The actual files that would be deployed
2. **Production Environment**: Same conditions as production
3. **Build Process**: Ensures the build works correctly
4. **File Loading**: Tests file paths and dependencies
5. **Performance**: Production-optimized files

## Testing Checklist

When running E2E tests, verify:

### Core Functionality
- [ ] App starts without errors
- [ ] All UI elements load correctly
- [ ] File upload works
- [ ] Audio recording works
- [ ] Transcription completes successfully

### Timestamp Features (Your Recent Fixes)
- [ ] Timestamps display correctly (not NaN:NaN.NaN)
- [ ] Timestamped view shows segments
- [ ] Scroll functionality works in timestamped view
- [ ] Toggle between plain text and timestamped views
- [ ] Copy functionality works in both views

### Error Handling
- [ ] Invalid files are handled gracefully
- [ ] Network errors are handled
- [ ] Missing Whisper models are reported

## Troubleshooting

### Build Fails
```bash
# Clean and rebuild
rm -rf src/renderer/dist
npm run build:renderer
```

### App Won't Start
```bash
# Check if Whisper is set up
npm run setup-whisper

# Verify build files exist
ls -la src/renderer/dist/
```

### Console Errors
1. Open Developer Tools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests

## File Structure

```
src/renderer/
├── index.html          # Source HTML
├── index.js            # Source JavaScript  
├── styles/
│   └── main.css        # Source CSS
└── dist/               # Built files (E2E testing uses these)
    ├── index.html      # Built HTML
    ├── index.js        # Built JavaScript
    └── styles/
        └── main.css    # Built CSS
```

## Environment Variables

The E2E scripts set these environment variables:

- `NODE_ENV=production` - Enables production mode
- `E2E_TESTING=true` - Indicates E2E testing (optional, for custom logic)

## Integration with CI/CD

You can use these scripts in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: |
    npm run start:e2e &
    sleep 10
    # Run your automated tests here
    pkill -f electron
```

## Tips

1. **Always test with built files** before deploying
2. **Use E2E scripts for bug reproduction** - ensures you're testing production code
3. **Test on different platforms** - macOS, Windows, Linux
4. **Monitor console logs** - check for warnings or errors
5. **Test with various file formats** - MP3, MP4, WAV, etc.

## Next Steps

After E2E testing, you can:
1. Package the app: `npm run package`
2. Run automated tests: `npm run test:e2e`
3. Deploy or distribute the application