#!/bin/bash

set -euo pipefail

DEFAULT_CMD=("npm" "run" "test:all")

cleanup() {
    if [[ -n "${XVFB_PID:-}" ]] && kill -0 "$XVFB_PID" 2>/dev/null; then
        echo "Cleaning up Xvfb..."
        kill "$XVFB_PID" 2>/dev/null || true
    fi

    # Remove stale X11 lock/socket files so future runs can start cleanly
    rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true
}

trap cleanup EXIT

# Clear out any stale Xvfb locks from previous runs
if [ -f /tmp/.X99-lock ]; then
    STALE_PID=$(cat /tmp/.X99-lock 2>/dev/null || true)
    if [ -n "${STALE_PID:-}" ] && kill -0 "$STALE_PID" 2>/dev/null; then
        echo "Terminating lingering Xvfb process (PID: $STALE_PID)..."
        kill "$STALE_PID" 2>/dev/null || true
        sleep 1
    fi
    echo "Removing stale /tmp/.X99-lock file"
    rm -f /tmp/.X99-lock
fi

if [ -S /tmp/.X11-unix/X99 ]; then
    echo "Removing stale /tmp/.X11-unix/X99 socket"
    rm -f /tmp/.X11-unix/X99
fi

# Start Xvfb in background so headed Chromium can connect
echo "Starting Xvfb..."
Xvfb :99 -screen 0 1280x720x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!

# Wait for Xvfb to be ready before kicking off Playwright
echo "Waiting for Xvfb to start..."
sleep 3

# Verify Xvfb is running to avoid silent browser failures
if kill -0 "$XVFB_PID" 2>/dev/null; then
    echo "Xvfb started successfully (PID: $XVFB_PID)"
else
    echo "Xvfb failed to start"
    exit 1
fi

# Set DISPLAY environment variable for Chromium
export DISPLAY=:99

# Check if Playwright browsers are installed for debugging context
echo "Checking Playwright browser installation..."
if npx playwright --version >/dev/null 2>&1; then
    echo "Playwright is available"
    if [ -d ~/.cache/ms-playwright ]; then
        echo "Playwright browsers directory exists"
        ls -la ~/.cache/ms-playwright/ 2>/dev/null || echo "Could not list browsers directory"
    else
        echo "Playwright browsers directory not found"
    fi
else
    echo "Playwright is not available"
fi

# Determine which command to run (custom command overrides default)
if [ "$#" -gt 0 ]; then
    echo "Starting tests with custom command: $*"
    set +e
    "$@"
    TEST_EXIT=$?
    set -e
else
    echo "Starting tests with default command: ${DEFAULT_CMD[*]}"
    set +e
    "${DEFAULT_CMD[@]}"
    TEST_EXIT=$?
    set -e
fi

exit "$TEST_EXIT"