# dsh-monitor-banner

> A permanent bottom strip for DeepSeek Harness that tells you how old your Markdown monitor log is.

## Why

If you keep a checklist you refresh weekly or monthly — market signals, position reviews, health logs, competitor watch — the problem is rarely "no table". It is that **you forget to look, and you cannot tell whether it is stale**.

This plugin moves freshness to a place you cannot miss: the strip under the three columns. Green dot means still fresh, orange means the check is due.

```text
● Monitor log: today · all fresh                    [ ▾ 5 ]  ↻

Click [ ▾ 5 ] to expand one task per indicator in place:
  ○ Big-four capex guidance → Raised      quarterly · 1 day ago · fresh
  ○ CDX HY/iTraxx → No                    weekly · today · fresh
  ● Citi CESI/CECID → Still rising        monthly · 31 days ago · due
```

## How it works

- The **Host** treats every indicator in the table as its own task: the `weekly/monthly/quarterly` cadence sets that task's due threshold, and each task reports its own age. The newest row also becomes the overall state.
- It serves that as JSON at `GET /dsh-monitor-banner/status`.
- The **Client** mounts into the `shell.bottom` slot. Collapsed it is **one 22px line**: `Monitor log: today · all fresh`.
- **`▾ N` only appears when there is more than one task.** Expanding lists one row per indicator with its own cadence, age, and due state; with a single task the line already says everything, so no control is shown.
- With several logs configured, the expanded view groups tasks by file and puts **📂** on each file's header row.
- **Click the text** to open the log in its default application (`.xlsx` goes to WPS/Excel, `.md` to your editor); **📂** reveals it in the file manager; **↻** reads again immediately.
- When the Host cannot open paths (plain browser, or a file outside the workspace) the click falls back to copying the path and says so in the strip.

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
| `files` | `[]` | One entry per log: `{ file, label?, staleDays? }`. Falls back to `local.config.json` when empty |
| `file` | `''` | Legacy single-log field; still read when `files` is empty |
| `label` | file name | Prefix shown in the strip; defaults to the file name without its extension |
| `staleDays` | `7` | Days after which the strip turns orange |

## Watching several logs

Every entry in `files` gets its own row: its own age, its own colour, its own click target.

```yaml
files:
  - file: 'C:\Users\me\Desktop\monitor\signals.md'
    label: 'Signals'
    staleDays: 7
  - file: 'D:\notes\positions.md'
    label: 'Positions'
    staleDays: 14
  - file: 'D:\notes\health.md'
```

More than three rows collapse behind "N more logs — click to expand" so the strip stays short. A file that cannot be read only affects its own row.

To keep machine-specific paths out of your commits, put the same fields in `local.config.json` (already in `.gitignore`):

```json
{
  "files": [
    { "file": "C:\\Users\\me\\Desktop\\monitor\\signals.md", "label": "Signals", "staleDays": 7 }
  ]
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
