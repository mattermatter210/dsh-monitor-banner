# dsh-monitor-banner

> A permanent bottom strip for DeepSeek Harness that tells you how old your Markdown monitor log is.

## Why

If you keep a checklist you refresh weekly or monthly — market signals, position reviews, health logs, competitor watch — the problem is rarely "no table". It is that **you forget to look, and you cannot tell whether it is stale**.

This plugin moves freshness to a place you cannot miss: the strip under the three columns. Green dot means still fresh, orange means the check is due.

```text
● Monitor log: today (2026-11-15) | latest: summary → mildly positive | all fresh
● Monitor log: 9 days ago (2026-11-06) | latest: CDX HY/iTraxx → no | 9 days stale — run the check
```

## How it works

- The **Host** reads your log file, takes the last table row as the latest conclusion, and computes the age in days.
- It serves that as JSON at `GET /dsh-monitor-banner/status`.
- The **Client** mounts into the `shell.bottom` slot (the full-width row under the three columns), refreshes every 30 seconds and whenever the window regains focus.
- Click the text to copy the file path; click ↻ to read again immediately.

## Install

Either:

```bash
# Local directory (best while developing — linked install, refresh to reload)
# DSH → Plugins → Add plugin → pick this directory

# Or from the CLI
dsh plugin add /path/to/dsh-monitor-banner
```

Refresh the page (Ctrl+R) and the strip appears at the bottom. If it says the log path is not configured, fill it in as described below.

## Configuration

`config` in `cordis.patch.yml`:

| Field | Default | Meaning |
|---|---|---|
| `file` | `''` | Absolute path to the log. When empty, `local.config.json` next to the plugin is used instead |
| `label` | `Monitor log` | Prefix shown in the strip |
| `staleDays` | `7` | Days after which the strip turns orange |

To keep a machine-specific path out of your commits, leave `file` empty and use `local.config.json` (already in `.gitignore`):

```json
{
  "file": "C:\\Users\\me\\Desktop\\monitor\\log.md",
  "label": "Monitor log",
  "staleDays": 7
}
```

## Log format

A Markdown table; data rows start with a date and the fourth column is read as the conclusion:

```markdown
| Date | Indicator | Cadence | Conclusion | Source | Note |
| --- | --- | --- | --- | --- | --- |
| 2026-11-15 | Big-four capex guidance | Quarterly | Raised | IR filings | ~$202B in Q3 across the four |
```

Column headers are decorative — the plugin reads positions: date, indicator, cadence, conclusion. Appending a row is "updating"; nothing restarts.

## Limits

- **Markdown tables only** — no CSV, Excel, or JSON. Adapt `lastRow()` if you need another shape.
- It occupies the root-level `shell.bottom` single slot, so only one plugin can own it at a time.
- Refresh is a 30-second poll, not a filesystem watch, so a new row can lag slightly.
- Strip copy switches between Chinese and English by browser language; it does not use the full locale service.

## Development

```bash
git clone <repo> dsh-monitor-banner
# DSH → Plugins → Add plugin → select this directory (installs as a symlink)
# Edit index.js / client.js, then refresh the page
```

To debug the Host half without the UI:

```bash
curl http://127.0.0.1:<port>/dsh-monitor-banner/status
```

## License

MIT
