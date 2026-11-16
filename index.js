/**
 * Host half of dsh-monitor-banner.
 *
 * Reads one or more monitor logs (Markdown tables) and serves their state at
 * GET /dsh-monitor-banner/status. Besides the newest row per file, each file
 * reports every indicator as its own task with its own age and due state, so
 * the strip can expand into the full task list.
 */
import { readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

export const inject = ['webServer']

const ROUTE = '/dsh-monitor-banner/status'
const DAY = 86_400_000
const LOCAL_CONFIG = fileURLToPath(new URL('./local.config.json', import.meta.url))
const CADENCE_DAYS = { 每周: 7, 每月: 31, 每季度: 92 }

/** Every data row of the log table, oldest first. */
function allRows(text) {
  const rows = []
  for (const line of text.split('\n')) {
    if (!/^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(line)) continue
    const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean)
    rows.push({
      date: cells[0] ?? null,
      indicator: cells[1] ?? null,
      cadence: cells[2] ?? null,
      conclusion: cells[3] ?? null,
    })
  }
  return rows
}

function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY)
}

function daysSince(date, today) {
  return dayNumber(today) - dayNumber(date)
}

/** Latest row per indicator, ordered as the log first introduced them. */
function tasksOf(rows, fallbackStale, today) {
  const latest = new Map()
  for (const row of rows) {
    const key = row.indicator ?? '—'
    const seen = latest.get(key)
    if (seen === undefined || String(row.date) > String(seen.date)) latest.set(key, row)
  }
  return [...latest.values()].map((row) => {
    const dueDays = CADENCE_DAYS[row.cadence] ?? fallbackStale
    const days = row.date === null ? null : daysSince(new Date(row.date), today)
    return {
      indicator: row.indicator,
      cadence: row.cadence,
      conclusion: row.conclusion,
      date: row.date,
      days,
      dueDays,
      due: days !== null && days >= dueDays,
    }
  })
}

function localSettings() {
  try {
    const parsed = JSON.parse(readFileSync(LOCAL_CONFIG, 'utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/** Default label: the file name without its extension. */
function labelOf(file, fallback) {
  if (typeof fallback === 'string' && fallback.length > 0) return fallback
  return basename(file).replace(/\.[^.]+$/, '')
}

/** One entry from a list item or the legacy single-file fields. */
function entryOf(source, defaults) {
  if (typeof source === 'string') return { file: source, ...defaults, label: labelOf(source) }
  if (typeof source !== 'object' || source === null) return null
  const file = typeof source.file === 'string' && source.file.length > 0 ? source.file : null
  if (file === null) return null
  const staleDays = Number.isFinite(source.staleDays) && source.staleDays > 0
    ? source.staleDays
    : defaults.staleDays
  return { file, label: labelOf(file, source.label), staleDays }
}

function settingsOf(config) {
  const local = localSettings()
  const defaults = {
    staleDays: [config.staleDays, local.staleDays]
      .find((value) => Number.isFinite(value) && value > 0) ?? 7,
  }

  const listed = Array.isArray(config.files) && config.files.length > 0
    ? config.files
    : Array.isArray(local.files) && local.files.length > 0 ? local.files : null

  if (listed !== null) {
    return listed.map((item) => entryOf(item, defaults)).filter((entry) => entry !== null)
  }

  const single = typeof config.file === 'string' && config.file.length > 0
    ? config.file
    : typeof local.file === 'string' && local.file.length > 0 ? local.file : null
  if (single === null) return []
  return [entryOf({ file: single, label: local.label ?? config.label }, defaults)]
}

/** Prefer a rendered sibling over the raw Markdown when the user clicks a row. */
async function renderedSibling(file) {
  for (const extension of ['.xlsx', '.html']) {
    const candidate = file.replace(/\.md$/i, extension)
    if (candidate === file) break
    try {
      await stat(candidate)
      return candidate
    } catch {
      continue
    }
  }
  return file
}

async function snapshot(entry, today) {
  const base = { label: entry.label, staleDays: entry.staleDays }
  try {
    const info = await stat(entry.file)
    const rows = allRows(await readFile(entry.file, 'utf8'))
    const newest = rows.length === 0 ? null : rows[rows.length - 1]
    const stamp = new Date(newest === null ? info.mtime : newest.date)
    return {
      ...base,
      file: entry.file,
      openTarget: await renderedSibling(entry.file),
      exists: true,
      updatedAt: stamp.toISOString(),
      days: daysSince(stamp, today),
      row: newest,
      tasks: tasksOf(rows, entry.staleDays, today),
    }
  } catch (error) {
    return { ...base, file: entry.file, exists: false, error: String(error.code ?? error), tasks: [] }
  }
}

export function apply(ctx, config = {}) {
  const entries = settingsOf(config)
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE,
    resource: async () => {
      const today = new Date()
      return new Response(JSON.stringify({
        configured: entries.length > 0,
        items: await Promise.all(entries.map((entry) => snapshot(entry, today))),
      }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      })
    },
  }))
}
