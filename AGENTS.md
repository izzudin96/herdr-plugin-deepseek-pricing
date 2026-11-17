# herdr-plugin-deepseek-pricing

Status: done. Implemented and linked locally on 2026-11-17.

Herdr plugin that shows DeepSeek Flash peak/off-peak pricing.

- Plan: `../env/plans/2026-11-17-deepseek-pricing.md`
- Repo: standalone git repository
- Plugin id: `deepseek.pricing`
- Runtime: Node, no dependencies.
- Entrypoints: `bin/status.js`, `bin/watch.js`, `bin/open.js`.
- Install: `herdr plugin link .`
- Keybinding: `prefix+shift+m` (configured in `~/.config/herdr/config.toml`).

## Commands

- Test: `npm test`
- Current status: `node bin/status.js`
- JSON: `node bin/status.js --json`
- Fixed time: `node bin/status.js --at 2026-11-17T02:00:00Z`
- Open the pane: `herdr plugin action invoke deepseek.pricing.show`
- Link: `herdr plugin link .`

## How it works

- Peak is Monday-Friday, `01:00-04:00` and `06:00-10:00` UTC, excluding
  Chinese public holidays.
- Weekends and Chinese public holidays are off-peak all day.
- Off-peak prices are validated to be exactly half of peak prices.
- `bin/watch.js` renders a live pane and reports workspace token `$deepseek`
  (`PEAK` or `OFF-PEAK`) with a 90s TTL. The sidebar row is configured in the
  Herdr config; the badge expires when the pane is closed.
- `bin/open.js` opens the watch pane as an overlay.

## Data

- `pricing.json` contains the official Flash peak and off-peak prices.
  Override it with `$HERDR_PLUGIN_CONFIG_DIR/pricing.json`.
- `holidays/<year>.json` comes from `NateScarlet/holiday-cn` (MIT, see
  `holidays/LICENSE` and `holidays/SOURCE.md`).
- Override a year with `$HERDR_PLUGIN_CONFIG_DIR/holidays/<year>.json`.
- A missing holiday year fails loudly; add the file from the source above.

## Constraints

- Do not invent prices or silently default them.
- Keep off-peak exactly half of peak; the validator rejects mismatches.
- Herdr 0.9.5 CLI does not expose `popup` placement, so the pane uses
  `overlay`.
