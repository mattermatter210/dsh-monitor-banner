/**
 * Client half: one flat 22px strip under the three columns.
 *
 * Collapsed it shows a single line — how many tasks are due and whether the
 * newest row is fresh. The caret expands every indicator as its own task row
 * with its own cadence, age, and due state. Clicking any line opens that log in
 * its default desktop application through DSH's open-in-app remote.
 */
window.__ModuleLoader__.load({
  id: 'dsh-monitor-banner',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useState } = React

    const ENDPOINT = '/dsh-monitor-banner/status'
    const ZH = String(navigator.language || '').toLowerCase().startsWith('zh')
    const LINE = 22
    const TASK_LINE = 20

    const copy = ZH
      ? {
        loading: '读取中…',
        unconfigured: '未配置日志路径',
        unreadable: (error) => `读不到文件（${error}）`,
        today: '今天',
        daysAgo: (days) => `${days} 天前`,
        fresh: '全部在期内',
        due: (count) => `${count} 项到期`,
        noTasks: '还没有结论行',
        tipOpen: (file) => `点击用默认程序打开：${file}`,
        tipReveal: '在文件资源管理器中定位',
        tipRefresh: '重新读取',
        tipExpand: '展开所有任务',
        tipCollapse: '收起',
        dueTag: '到期',
        okTag: '在期内',
        copied: '已复制路径',
        openFailed: '打不开，已复制路径',
      }
      : {
        loading: 'reading…',
        unconfigured: 'no log path configured',
        unreadable: (error) => `cannot read file (${error})`,
        today: 'today',
        daysAgo: (days) => `${days} days ago`,
        fresh: 'all fresh',
        due: (count) => `${count} due`,
        noTasks: 'no conclusion rows yet',
        tipOpen: (file) => `Click to open in its default app: ${file}`,
        tipReveal: 'Reveal in the file manager',
        tipRefresh: 'Refresh',
        tipExpand: 'Show every task',
        tipCollapse: 'Collapse',
        dueTag: 'due',
        okTag: 'fresh',
        copied: 'path copied',
        openFailed: 'cannot open — path copied',
      }

    const dotColor = (tone) => (tone === 'warn' ? '#d98324' : tone === 'ok' ? '#3f9c5a' : 'rgba(127,127,127,0.6)')
    const dot = (tone) => h('span', {
      style: { flex: 'none', width: 6, height: 6, borderRadius: '50%', background: dotColor(tone) },
    })

    function Strip(props) {
      const [state, setState] = useState(null)
      const [tick, setTick] = useState(0)
      const [flash, setFlash] = useState(null)
      const [open, setOpen] = useState(false)

      useEffect(() => {
        let alive = true
        const load = () => fetch(ENDPOINT, { cache: 'no-store' })
          .then((response) => response.json())
          .then((value) => { if (alive) setState(value) })
          .catch(() => { if (alive) setState({ configured: true, items: [{ exists: false, error: 'endpoint' }] }) })
        load()
        const timer = setInterval(load, 30_000)
        window.addEventListener('focus', load)
        return () => {
          alive = false
          clearInterval(timer)
          window.removeEventListener('focus', load)
        }
      }, [tick])

      useEffect(() => {
        if (flash === null) return undefined
        const timer = setTimeout(() => setFlash(null), 2400)
        return () => clearTimeout(timer)
      }, [flash])

      // Older Host payloads carried a single log at the top level.
      const items = state === null
        ? []
        : Array.isArray(state.items) ? state.items
          : state.file ? [state] : []
      const configured = state !== null && state.configured !== false && items.length > 0
      const groups = items.map((item) => ({
        item,
        tasks: Array.isArray(item.tasks) ? item.tasks : [],
      }))
      const dueTotal = groups.reduce((sum, group) => sum + group.tasks.filter((task) => task.due).length, 0)

      const openLog = async (item) => {
        const path = item?.openTarget ?? item?.file
        if (!path) return
        const opened = await props.open?.(path)
        if (!opened) {
          await props.copy?.(path)
          setFlash(copy.openFailed)
        }
      }

      const revealLog = async (item) => {
        if (!item?.file) return
        const revealed = await props.reveal?.(item.file)
        if (!revealed) {
          await props.copy?.(item.file)
          setFlash(copy.copied)
        }
      }

      const button = (label, title, onClick) => h('button', {
        type: 'button', title, onClick,
        style: {
          flex: 'none', border: 0, background: 'transparent', color: 'inherit',
          cursor: 'pointer', fontSize: 11, lineHeight: '1', padding: '2px 4px',
        },
      }, label)

      /** The expander has to be findable: a plain glyph at 11px is easy to miss. */
      const toggle = (active, count) => h('button', {
        type: 'button',
        title: active ? copy.tipCollapse : copy.tipExpand,
        onClick: () => setOpen((value) => !value),
        style: {
          flex: 'none', border: '1px solid var(--dsw-alias-border-1, rgba(127,127,127,0.4))',
          background: 'var(--dsw-alias-bg-2, rgba(127,127,127,0.12))',
          color: 'inherit', cursor: 'pointer', fontSize: 11, lineHeight: '1',
          padding: '2px 7px', borderRadius: 9, marginLeft: 2,
        },
      }, active ? `▴ ${copy.tipCollapse}` : `▾ ${count}`)

      const summary = () => {
        if (state === null) return { text: copy.loading, tone: 'muted' }
        if (!configured) return { text: copy.unconfigured, tone: 'warn' }
        const broken = groups.find((group) => !group.item.exists)
        if (broken !== undefined && groups.length === 1) {
          return { text: copy.unreadable(broken.item.error ?? 'unknown'), tone: 'warn' }
        }
        const tag = dueTotal > 0 ? copy.due(dueTotal) : copy.fresh
        const tone = dueTotal > 0 ? 'warn' : 'ok'
        if (groups.length === 1) {
          const item = groups[0].item
          const newest = groups[0].tasks.find((task) => task.days !== null)
          const when = newest === undefined ? item.label : newest.days <= 0 ? copy.today : copy.daysAgo(newest.days)
          return { text: `${item.label}: ${when} · ${tag}`, tone }
        }
        return { text: `${groups.length} 个日志 · ${tag}`, tone }
      }

      const head = flash === null ? summary() : { text: flash, tone: 'info' }
      const taskCount = groups.reduce((sum, group) => sum + group.tasks.length, 0)

      const taskRow = (group, task) => h('div', {
        key: `${group.item.file}-${task.indicator}`,
        title: copy.tipOpen(group.item.openTarget ?? group.item.file ?? ''),
        onClick: () => { void openLog(group.item) },
        style: {
          display: 'flex', alignItems: 'center', gap: 6, height: TASK_LINE,
          minWidth: 0, paddingLeft: 8, cursor: 'pointer',
        },
      },
        dot(task.due ? 'warn' : 'ok'),
        h('span', {
          style: {
            flex: 'none', maxWidth: '45%', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.95,
          },
        }, task.indicator ?? '—'),
        h('span', {
          style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.75 },
        }, `→ ${task.conclusion ?? '—'}`),
        h('span', {
          style: { flex: 'none', marginLeft: 'auto', whiteSpace: 'nowrap', opacity: 0.7 },
        }, `${task.cadence ?? ''} · ${task.days === null ? '—' : task.days <= 0 ? copy.today : copy.daysAgo(task.days)} · ${task.due ? copy.dueTag : copy.okTag}`),
      )

      const groupBlock = (group, index) => [
        groups.length > 1
          ? h('div', {
            key: `group-${index}`,
            style: { display: 'flex', alignItems: 'center', gap: 6, height: TASK_LINE, paddingLeft: 2, marginTop: index === 0 ? 0 : 2 },
          },
            dot(group.item.exists ? 'ok' : 'warn'),
            h('span', { style: { opacity: 0.9 } }, group.item.label),
            h('span', { style: { marginLeft: 'auto' } },
              button('📂', copy.tipReveal, () => { void revealLog(group.item) })),
          )
          : null,
        ...group.tasks.map((task) => taskRow(group, task)),
      ]

      return h('div', {
        style: {
          padding: '0 10px',
          fontSize: 11.5,
          color: 'var(--dsw-alias-text-3, rgba(127,127,127,1))',
          borderTop: '1px solid var(--dsw-alias-border-1, rgba(127,127,127,0.25))',
        },
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, height: LINE } },
          dot(head.tone),
          h('span', {
            title: configured ? copy.tipOpen(items[0]?.openTarget ?? items[0]?.file ?? '') : head.text,
            onClick: () => { if (configured) void openLog(items[0]) },
            style: {
              minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              cursor: configured ? 'pointer' : 'default',
            },
          }, head.text),
          h('span', { style: { flex: 'none', marginLeft: 'auto', display: 'flex', alignItems: 'center' } },
            configured && items[0]?.file ? button('📂', copy.tipReveal, () => { void revealLog(items[0]) }) : null,
            // Only worth expanding when there is more than one task to reveal.
            taskCount > 1 ? toggle(open, taskCount) : null,
            button('↻', copy.tipRefresh, () => setTick((value) => value + 1)),
          ),
        ),
        open && configured
          ? h('div', { style: { paddingBottom: 4 } }, groups.flatMap((group, index) => groupBlock(group, index)))
          : null,
      )
    }

    return {
      inject: ['slots', 'remote', 'remote.session'],
      apply(ctx) {
        const session = ctx.remote?.session
        const call = async (request) => {
          try {
            const result = await session?.openWorkspacePath(request)
            return Boolean(result?.ok)
          } catch {
            return false
          }
        }
        ctx.slots.inject('shell.bottom', () => ctx.slots.register({
          name: 'shell.bottom',
          id: 'monitor-banner',
          order: 5,
          inject: () => ({
            open: (path) => call({ path }),
            reveal: (path) => call({ path, action: 'reveal' }),
            copy: async (path) => {
              try {
                await navigator.clipboard?.writeText(path)
                return true
              } catch {
                return false
              }
            },
          }),
        }, Strip))
      },
    }
  },
})
