import { useRoute } from './router'
import { refreshStore, useAppState } from './state/store'
import { BackupPage } from './pages/BackupPage'
import { Home } from './pages/Home'
import { LifePage } from './pages/LifePage'
import { PersonForm } from './pages/PersonForm'
import { TogetherPage } from './pages/TogetherPage'
import { WeekPage } from './pages/WeekPage'

function weekParam(q: URLSearchParams): number | undefined {
  const v = q.get('w')
  if (v === null || !/^-?\d+$/.test(v)) return undefined
  return Number(v)
}

export function App() {
  const st = useAppState()
  const { parts, query } = useRoute()
  if (!st.ready) return <div class="page loading">正在打开…</div>
  const [a, b, c] = parts
  let page
  if (a === 'person' && b === 'new') page = <PersonForm key="new" rel={query.get('rel') ?? undefined} />
  else if (a === 'person' && b && c === 'edit') page = <PersonForm key={b} id={b} />
  else if (a === 'life' && b) page = <LifePage key={b} id={b} week={weekParam(query)} />
  else if (a === 'week') page = <WeekPage week={weekParam(query)} />
  else if (a === 'together') page = <TogetherPage />
  else if (a === 'backup') page = <BackupPage />
  else page = <Home />
  return (
    <>
      {st.writeWarning && (
        <div class="global-warning notice warn" role="alert">
          <p>{st.writeWarning}</p>
          <button type="button" class="btn small" onClick={() => void refreshStore()}>重新读取本机数据</button>
        </div>
      )}
      {page}
    </>
  )
}
