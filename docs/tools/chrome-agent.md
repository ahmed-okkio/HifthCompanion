# chrome-agent — CDP browser automation for testing

CLI that lets an AI agent (or you) drive a real Chrome via the Chrome DevTools
Protocol. Full CDP access, no Playwright/Puppeteer layer. Useful for poking at
Hifth Companion in a real browser during dev.

- Author: Corey J. Gallon (`captivus`) — <https://github.com/captivus/chrome-agent>
- Installed: v0.6.0, isolated in its own `uv` venv (does not touch project deps).

## Install (already done on this machine)

```bash
uv tool install chrome-agent        # exe -> ~/.local/bin/chrome-agent.exe (on PATH)
```

Requires Python 3.11+ and a system Chrome/Chromium. `uv` lives at
`%APPDATA%\Python\Python312\Scripts` if not already on PATH.

> Note: installed via `uv tool` on purpose — a plain `pip install --user` bumps
> `websockets` to 17.x and breaks `frida-tools` (needs <14). The isolated venv
> avoids that.

## Usage

```bash
chrome-agent launch                 # start Chrome (add --headless for CI)
chrome-agent status                 # list instances + tabs
chrome-agent attach <instance>      # stream CDP events
chrome-agent help [Domain.method]   # protocol discovery
chrome-agent stop <instance>        # close browser (or a tab with --target)
chrome-agent guide                  # full agent guide
```

Dev server runs on the app's usual port; `launch` then navigate to it to test.

## When to use this vs. Playwright

This is the **preferred tool for agents to manually/exploratorily test** the
running app — driving a real Chrome to poke at a change, reproduce a bug, or
confirm a fix by eye. Playwright (`npm run test:e2e`) stays the **automated
regression gate** required by AGENTS.md. Different jobs: use chrome-agent to
explore, then codify what matters as a Playwright E2E. chrome-agent does not
replace `npm run test:e2e`.
