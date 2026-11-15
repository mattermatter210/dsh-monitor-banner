/**
 * Client half: one strip under the three columns, fed by the Host route.
 * Text follows the browser language; the strip needs no plugin state of its own.
 */
window.__ModuleLoader__.load({
  id: 'dsh-monitor-banner',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useState } = React

    const ENDPOINT = '/dsh-monitor-banner/status'
    const ZH = String(navigator.language || '').toLowerCase().startsWith('zh')

    const copy = ZH
      ? {
        loading: '读取中…',
        unconfigured: '未配置日志路径',
        unreadable: (error) => `读不到文件（${error}）`,
        today: '今天',
        daysAgo: (days) => `${days} 天前`,
        empty: '还没有任何结论行',
        recent: '最近',
        due: (days) => `已 ${days} 天未更新，可跑一次`,
        ok: '均在期内',
        copyPath: (file) => `点击复制路径：${file}`,
        refresh: '重新读取',
      }
      : {
        loading: 'reading…',
        unconfigured: 'no log path configured',
        unreadable: (error) => `cannot read file (${error})`,
        today: 'today',
        daysAgo: (days) => `${days} days ago`,
        empty: 'no conclusion rows yet',
        recent: 'latest',
        due: (days) => `${days} days stale — run the check`,
        ok: 'all fresh',
        copyPath: (file) => `Click to copy the path: ${file}`,
        refresh: 'Refresh',
      }

    function describe(state) {
      if (state === null) return { text: copy.loading, tone: 'muted' }
      // `configured` is absent on an older Host half; only its explicit false blocks rendering.
      if (state.configured === false) return { text: copy.unconfigured, tone: 'warn' }
      if (!state.exists) return { text: copy.unreadable(state.error ?? 'unknown'), tone: 'warn' }
      const label = state.label ?? 'Monitor log'
      const staleDays = state.staleDays ?? 7
      const when = state.days <= 0 ? copy.today : copy.daysAgo(state.days)
      const row = state.row === null || state.row === undefined
        ? copy.empty
        : `${copy.recent}: ${state.row.indicator} → ${state.row.conclusion}`
      const due = state.days >= staleDays ? copy.due(state.days) : copy.ok
      return {
        text: `${label}: ${when} (${state.updatedAt.slice(0, 10)}) | ${row} | ${due}`,
        tone: state.days >= staleDays ? 'warn' : 'ok',
      }
    }

    function Strip() {
      const [state, setState] = useState(null)
      const [tick, setTick] = useState(0)

      useEffect(() => {
        let alive = true
        const load = () => fetch(ENDPOINT, { cache: 'no-store' })
          .then((response) => response.json())
          .then((value) => { if (alive) setState(value) })
          .catch(() => { if (alive) setState({ configured: true, exists: false, error: 'endpoint' }) })
        load()
        const timer = setInterval(load, 30_000)
        window.addEventListener('focus', load)
        return () => {
          alive = false
          clearInterval(timer)
          window.removeEventListener('focus', load)
        }
      }, [tick])

      const { text, tone } = describe(state)
      const dot = tone === 'warn' ? '#d98324' : tone === 'ok' ? '#3f9c5a' : 'rgba(127,127,127,0.6)'

      return h('div', {
        title: state?.file ? copy.copyPath(state.file) : text,
        style: {
          display: 'flex', alignItems: 'center', gap: 8,
          height: 26, padding: '0 12px', fontSize: 12,
          whiteSpace: 'nowrap', overflow: 'hidden',
          color: 'var(--dsw-alias-text-3, rgba(127,127,127,1))',
          borderTop: '1px solid var(--dsw-alias-border-1, rgba(127,127,127,0.25))',
        },
      },
        h('span', { style: { flex: 'none', width: 6, height: 6, borderRadius: '50%', background: dot } }),
        h('span', {
          style: { cursor: state?.file ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis' },
          onClick: () => { if (state?.file) navigator.clipboard?.writeText(state.file) },
        }, text),
        h('button', {
          type: 'button',
          title: copy.refresh,
          onClick: () => setTick((value) => value + 1),
          style: {
            flex: 'none', marginLeft: 'auto', border: 0, background: 'transparent',
            color: 'inherit', cursor: 'pointer', fontSize: 12, padding: '0 2px',
          },
        }, '↻'),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('shell.bottom', () => ctx.slots.register({
          name: 'shell.bottom', id: 'monitor-banner', order: 5,
        }, Strip))
      },
    }
  },
})
