/**
 * Host half of dsh-monitor-banner.
 *
 * Reads a monitor log (Markdown table) and serves its freshness as JSON at
 * GET /dsh-monitor-banner/status. The browser cannot touch the filesystem, so
 * the Host does the stat, the parse, and the age arithmetic.
 *
 * Configuration precedence: the row's `config.file`, then `local.config.json`
 * next to this file (git-ignored, for a machine-local path), then unconfigured.
 */
import { readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const inject = ['webServer']

const ROUTE = '/dsh-monitor-banner/status'
const DAY = 86_400_000
const LOCAL_CONFIG = fileURLToPath(new URL('./local.config.json', import.meta.url))

/** Last data row of the log table: | 日期 | 指标 | 频率 | 结论 | 来源 | 备注 | */
function lastRow(text) {
  const rows = text.split('\n').filter((line) => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(line))
  if (rows.length === 0) return null
  const cells = rows[rows.length - 1].split('|').map((cell) => cell.trim()).filter(Boolean)
  return {
    date: cells[0] ?? null,
    indicator: cells[1] ?? null,
    cadence: cells[2] ?? null,
    conclusion: cells[3] ?? null,
  }
}

function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY)
}

function localSettings() {
  try {
    const parsed = JSON.parse(readFileSync(LOCAL_CONFIG, 'utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function settingsOf(config) {
  const local = localSettings()
  const file = typeof config.file === 'string' && config.file.length > 0
    ? config.file
    : typeof local.file === 'string' && local.file.length > 0 ? local.file : null
  const label = typeof config.label === 'string' && config.label.length > 0
    ? config.label
    : typeof local.label === 'string' ? local.label : 'Monitor log'
  const staleDays = Number.isFinite(config.staleDays) && config.staleDays > 0
    ? config.staleDays
    : Number.isFinite(local.staleDays) && local.staleDays > 0 ? local.staleDays : 7
  return { file, label, staleDays }
}

async function snapshot({ file, label, staleDays }) {
  if (file === null) return { configured: false, label, staleDays }
  try {
    const info = await stat(file)
    const row = lastRow(await readFile(file, 'utf8'))
    const stamp = new Date(row === null ? info.mtime : row.date)
    return {
      configured: true,
      file,
      label,
      staleDays,
      exists: true,
      updatedAt: stamp.toISOString(),
      days: dayNumber(new Date()) - dayNumber(stamp),
      row,
    }
  } catch (error) {
    return { configured: true, file, label, staleDays, exists: false, error: String(error.code ?? error) }
  }
}

export function apply(ctx, config = {}) {
  const settings = settingsOf(config)
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE,
    resource: async () => new Response(JSON.stringify(await snapshot(settings)), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    }),
  }))
}
