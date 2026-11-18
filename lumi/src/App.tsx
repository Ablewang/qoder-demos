import { useEffect, useRef, useState } from 'react'
import { Link, matchPath, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, ClipboardList, Home as HomeIcon, MapPin, Menu, MessageSquare, Moon, Settings2, SquarePen, Sun } from 'lucide-react'
import { Home } from './features/home/Home'
import { Saved } from './features/home/Saved'
import { Chat, type ChatViewState } from './features/chat/Chat'
import { Composer } from './features/chat/Composer'
import { useChat } from './hooks/useChat'
import { failOncePending } from './api/client'
import { newConversation, useApp } from './store/AppStore'
import { Badge, Button, IconButton, LumiMark, Modal, useToast } from './ui'
import styles from './app.module.css'

type Network = 'normal' | 'slow' | 'fail'
const networks: { value: Network; label: string; hint: string }[] = [
  { value: 'normal', label: '正常网络', hint: '首字约 0.5–1 秒' },
  { value: 'slow', label: '模拟慢网络', hint: '首字约 5 秒，可体验停止' },
  { value: 'fail', label: '下一次请求失败', hint: '只失败一次，可体验重试' },
]
const demoKeys = ['mock_latency', 'mock_error', 'mock_fail', 'mock_nonce']

export default function App() {
  const { state, dispatch, persistenceError } = useApp()
  const chat = useChat()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const match = matchPath('/chat/:id', location.pathname)
  const conversation = state.conversations.find(c => c.id === match?.params.id)
  const savedPage = location.pathname === '/saved'
  const newChatPage = location.pathname === '/chat'
  const homePage = location.pathname === '/'
  const views = useRef<Record<string, ChatViewState>>({})
  const resumeId = chat.busyId || state.lastConversationId || state.conversations[0]?.id
  const resume = state.conversations.find(c => c.id === resumeId)
  const conversationPath = resume ? `/chat/${resume.id}` : '/chat'
  const draftKey = conversation?.id || (newChatPage ? 'new' : 'home')
  const title = conversation?.title || (savedPage ? '清单' : newChatPage ? '新对话' : 'Lumi')
  const params = new URLSearchParams(location.search)
  const failPending = failOncePending(location.search)
  const network: Network = failPending ? 'fail' : params.get('mock_latency') === 'slow' ? 'slow' : 'normal'
  const demoActive = network !== 'normal' || params.has('mock_fail')
  if (conversation && !views.current[conversation.id]) views.current[conversation.id] = {}
  useEffect(() => {
    if (conversation) dispatch({ type: 'visit', id: conversation.id })
  }, [conversation?.id, dispatch])
  useEffect(() => { setScrolled(false) }, [location.pathname])
  useEffect(() => {
    const viewport = window.visualViewport
    const update = () => {
      if (viewport && matchMedia('(max-width: 1023px)').matches) {
        document.documentElement.style.setProperty('--app-height', `${viewport.height}px`)
        document.documentElement.style.setProperty('--app-top', `${viewport.offsetTop}px`)
      } else {
        document.documentElement.style.removeProperty('--app-height')
        document.documentElement.style.removeProperty('--app-top')
      }
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => { viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])
  useEffect(() => {
    if (persistenceError) toast('浏览器未允许本地保存，本次内容刷新后可能丢失')
  }, [persistenceError, state.saved.length, toast])
  function go(path: string) { setMenuOpen(false); navigate(path + location.search) }
  function send(query: string): boolean {
    if (chat.isBusy()) { toast('Lumi 正在回复；草稿已保留，请等回复结束或明确停止后再发送'); return false }
    if (!query.trim() || query.length > 2000) return false
    setMenuOpen(false)
    if (conversation) void chat.send(conversation.id, query)
    else {
      const next = newConversation(query)
      dispatch({ type: 'create', conversation: next })
      navigate(`/chat/${next.id}${location.search}`)
      void chat.send(next.id, query)
    }
    return true
  }
  function setNetwork(value: Network) {
    const next = new URLSearchParams(location.search)
    demoKeys.forEach(key => next.delete(key))
    if (value === 'slow') next.set('mock_latency', 'slow')
    if (value === 'fail') { next.set('mock_error', 'once'); next.set('mock_nonce', crypto.randomUUID()) }
    const search = next.toString()
    navigate(`${location.pathname}${search ? `?${search}` : ''}`, { replace: true })
  }
  function openSettings() { setMenuOpen(false); setSettingsOpen(true) }
  const history = [...state.conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const navPanel = <div className={styles.navPanel}>
    <Link to="/chat" className={`${styles.row} ${styles.newChat}`} aria-current={newChatPage ? 'page' : undefined} onClick={e => { e.preventDefault(); go('/chat') }}><SquarePen size={18} strokeWidth={1.75} />新对话</Link>
    <nav className={styles.primaryNav} aria-label="主导航">
      <NavLink to="/" end className={styles.row} onClick={e => { e.preventDefault(); go('/') }}><HomeIcon size={18} strokeWidth={1.75} />首页</NavLink>
      <Link to={conversationPath} className={styles.row} onClick={e => { e.preventDefault(); go(conversationPath) }}><MessageSquare size={18} strokeWidth={1.75} />对话</Link>
      <NavLink to="/saved" className={styles.row} onClick={e => { e.preventDefault(); go('/saved') }}><ClipboardList size={18} strokeWidth={1.75} />清单{state.saved.length > 0 && <span className={styles.count}>{state.saved.length}</span>}</NavLink>
    </nav>
    <div className={styles.recent}>
      <h2 className={styles.groupLabel}>最近对话</h2>
      {history.length ? <nav aria-label="历史会话">{history.map(c => <NavLink key={c.id} to={`/chat/${c.id}`} onClick={e => { e.preventDefault(); go(`/chat/${c.id}`) }} title={c.title}><span>{c.title}</span>{chat.busyId === c.id && <i className={styles.busy} aria-hidden="true" />}</NavLink>)}</nav> : <p className={styles.noHistory}>还没有对话记录</p>}
    </div>
    <button className={styles.row} onClick={openSettings}><Settings2 size={18} strokeWidth={1.75} />设置</button>
  </div>
  const showBottomNav = !match && !newChatPage
  return <div className={styles.app}>
    <a href="#main-content" className={styles.skip}>跳到主要内容</a>
    <aside className={styles.sidebar}>
      <Link to={`/${location.search}`} className={styles.brand} title="回到首页" aria-label="Lumi 生活首页"><LumiMark size={24} />Lumi</Link>
      {navPanel}
    </aside>
    <div className={styles.main}>
      <header className={styles.header} data-scrolled={scrolled || undefined}>
        <div className={styles.headerLeft}><span className={styles.mobileMenu}><IconButton aria-label="打开菜单" onClick={() => setMenuOpen(true)}><Menu size={20} /></IconButton></span><Link to={`/${location.search}`} className={styles.homeMark} aria-label="回到首页" title="回到首页" aria-current={homePage ? 'page' : undefined}><LumiMark size={26} /></Link><span className={styles.headerTitle}>{title}</span></div>
        <div className={styles.headerRight}>
          <button className={styles.city} onClick={() => setLocationOpen(true)}><MapPin size={15} strokeWidth={1.75} /><span>杭州</span></button>
          <IconButton className={styles.themeToggle} aria-label="切换浅色或深色主题" title="切换浅色或深色主题" onClick={() => dispatch({ type: 'theme', theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' })}><Moon className={styles.themeMoon} size={18} /><Sun className={styles.themeSun} size={18} /></IconButton>
          <IconButton className={styles.settingsToggle} aria-label="偏好与演示设置" onClick={() => setSettingsOpen(true)}><Settings2 size={18} strokeWidth={1.75} /></IconButton>
          <IconButton className={styles.newToggle} aria-label="新建对话" title="开启独立的新对话" onClick={() => go('/chat')}><SquarePen size={19} strokeWidth={1.75} /></IconButton>
        </div>
      </header>
      {resume && conversation?.id !== resume.id && <div className={styles.activityBar}>
        <span role="status">{chat.busyId ? 'Lumi 正在回复，切页不会中断' : '上次对话已保留，可以继续聊'}</span>
        <Button variant="ghost" size="sm" onClick={() => go(conversationPath)}>{chat.busyId ? '查看正在生成的对话' : '继续上次对话'}</Button>
        {chat.busyId && <Button variant="ghost" size="sm" onClick={chat.stop} aria-label="停止后台生成">停止</Button>}
      </div>}
      <main id="main-content" tabIndex={-1} className={styles.content} onScrollCapture={e => setScrolled((e.target as HTMLElement).scrollTop > 2)}>
        {conversation && <Chat key={conversation.id} conversation={conversation} viewState={views.current[conversation.id]} busy={!!chat.busyId} onSend={send} onRetry={message => { if (message.query) void chat.send(conversation.id, message.query, message.id) }} />}
        {match && !conversation && <div className={styles.notFound}><h1>这段对话不在当前浏览器里</h1><p>会话仅保存在本机，你可以从一个新问题开始。</p><Button variant="secondary" onClick={() => go('/')}>返回生活首页</Button></div>}
        {newChatPage && <div className={styles.emptyChat}><h1>新对话</h1><p>今天想安排点什么？</p></div>}
        <div className={styles.pagePanel} hidden={!homePage}><div className={styles.pageScroll}><Home onSend={send} /></div></div>
        <div className={styles.pagePanel} hidden={!savedPage}><div className={styles.pageScroll}><Saved /></div></div>
      </main>
      {(homePage || newChatPage || conversation) && <Composer busy={!!chat.busyId && chat.busyId === conversation?.id} draft={state.drafts[draftKey] || ''} onDraft={value => dispatch({ type: 'draft', key: draftKey, value })} onSend={send} onStop={chat.stop} />}
      {showBottomNav && <nav className={styles.bottomNav} aria-label="快捷导航">
        <Link to="/" aria-current={homePage ? 'page' : undefined} onClick={e => { e.preventDefault(); go('/') }}><span className={styles.tabIcon}><HomeIcon size={21} strokeWidth={1.75} /></span><span>首页</span></Link>
        <Link to={conversationPath} onClick={e => { e.preventDefault(); go(conversationPath) }}><span className={styles.tabIcon}><MessageSquare size={21} strokeWidth={1.75} />{chat.busyId && <i />}</span><span>对话</span></Link>
        <Link to="/saved" aria-current={savedPage ? 'page' : undefined} onClick={e => { e.preventDefault(); go('/saved') }}><span className={styles.tabIcon}><ClipboardList size={21} strokeWidth={1.75} /></span><span>清单{state.saved.length ? ` · ${state.saved.length}` : ''}</span></Link>
      </nav>}
    </div>
    <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="菜单" heading={<span className={styles.drawerBrand}><LumiMark size={22} />Lumi</span>} variant="drawer"><div className={styles.drawerPanel}>{navPanel}</div></Modal>
    <Modal open={locationOpen} onClose={() => setLocationOpen(false)} title="当前演示位置"><div className={styles.locationDetail}><h2>杭州 · 武林广场</h2><p>本期采用杭州演示数据，没有读取你的真实位置。天气、附近地点与路线估算仅供体验。</p><Badge tone="green">未请求定位权限</Badge><Button variant="secondary" onClick={() => { setLocationOpen(false); send('从武林广场去西湖，怎么走比较方便？') }}>看看附近的出行灵感<ArrowUpRight size={16} /></Button></div></Modal>
    <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="设置">
      <section className={styles.settingSection}>
        <h2 className={styles.settingTitle}>外观</h2>
        <div className={styles.segmented} role="group" aria-label="外观">{([{ value: 'system', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }] as const).map(theme => <button key={theme.value} type="button" aria-pressed={state.theme === theme.value} onClick={() => dispatch({ type: 'theme', theme: theme.value })}>{theme.label}</button>)}</div>
      </section>
      <section className={styles.settingSection}>
        <div className={styles.settingHead}><h2 className={styles.settingTitle}>演示网络</h2><Button className={styles.reset} variant="ghost" size="sm" disabled={!demoActive} onClick={() => { setNetwork('normal'); toast('已恢复正常网络体验') }}>恢复正常</Button></div>
        <div className={styles.optionList}>{networks.map(item => <button key={item.value} type="button" aria-pressed={network === item.value} onClick={() => setNetwork(item.value)}><span className={styles.optionText}><span>{item.label}</span><small aria-hidden="true">{item.hint}</small></span>{network === item.value && <span className={styles.current} aria-hidden="true"><Check size={16} strokeWidth={2} />当前</span>}</button>)}</div>
        <p className={styles.settingNote}>回复来自本地模拟请求，没有连接真实服务端。设置在下一次提问时生效。</p>
      </section>
      <section className={styles.settingSection}>
        <h2 className={styles.settingTitle}>数据与地图</h2>
        <p className={styles.settingNote}>对话与清单仅保存在当前浏览器。百度地图底图需要在本地配置 AK；未配置时显示路线示意，仍可打开百度地图。</p>
      </section>
    </Modal>
  </div>
}
