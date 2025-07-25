---
description: Fixed settings panel display issues caused by CSS and duplicate event listeners
alwaysApply: false
---

Fixed two critical issues preventing the settings panel from displaying:

**Issue 1 - CSS Max-Height Problem:**
- Root cause: Base `.settings-header` class had `max-height: 0` which kept panel collapsed even with `visible` class
- Fix: Removed `max-height: 0` from base class in main.css, allowing proper CSS cascade:
  - `.settings-header` → No height restriction
  - `.settings-header.hidden` → `max-height: 0` (collapsed)
  - `.settings-header.visible` → `max-height: 1500px` (expanded)

**Issue 2 - Duplicate Event Listener Conflict:**
- Root cause: Settings button had two conflicting event listeners:
  1. `setupEventListeners()` → calls `openSettings()`
  2. `setupSettings()` → calls `toggleSettings()`
- Result: Click would open settings, then immediately close them (0.1s revert behavior)
- Fix: Removed all duplicate event listeners from `setupSettings()` method, keeping only centralized ones in `setupEventListeners()`

These fixes ensure the settings panel properly expands and stays open when the settings button is clicked.