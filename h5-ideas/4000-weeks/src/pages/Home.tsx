import { CalendarSample, TimeWeave } from '../grid/TimeWeave'
import { formatWeekRange } from '../lib/date'
import { ageLabel, fmt } from '../lib/copy'
import { RELATION_LABEL, birthWeek, isEntryEmpty, lastLivedWeek, themeHex } from '../lib/model'
import { go } from '../router'
import { getEntry, useAppState } from '../state/store'
import { TabBar } from '../ui/ui'
import { inLife } from './WeekSheet'

const DAY = 86_400_000

export function Home() {
  const st = useAppState()
  const { lives, today, currentWeek } = st
  let total = 0
  for (const m of st.entries.values()) total += m.size
  const backupAge = st.lastBackupAt ? Math.floor((Date.now() - st.lastBackupAt) / DAY) : null
  const present = lives.filter((l) => inLife(l, currentWeek, currentWeek))
  const written = present.filter((l) => { const e = getEntry(l.id, currentWeek); return e && !isEntryEmpty(e) }).length
  const needBackup = total >= 5 && (st.lastWriteAt ?? 0) > (st.lastBackupAt ?? 0) && (backupAge === null || backupAge >= 30)
  return (
    <div class="page home-page">
      <header class="masthead"><span class="wordmark">一周一格</span><button class="link-btn" onClick={() => go('/backup')}>备份</button></header>
      <header class="home-head">
        <h1>{lives.length ? '家人的时间页' : '日子，一周一格。'}</h1>
        <p class="sub">{formatWeekRange(currentWeek)}<span class="axis-line" />当前周</p>
        {present.length > 0 && (
          <div class="week-entry">
            <p>这一周已写 <b>{written}</b> / {present.length} 页</p>
            <button type="button" class="btn primary" onClick={() => go('/week')}>写这一周 ↗</button>
          </div>
        )}
      </header>
      {lives.length === 0 ? (
        <section class="welcome">
          <p class="lead">从出生那周展开，<br />留下每一周的一句话。</p>
          <div class="entry-start"><button type="button" class="btn primary" onClick={() => go('/person/new?rel=self')}>从我自己开始 ↗</button><button type="button" class="btn" onClick={() => go('/person/new')}>先为别人建一页</button></div>
          <CalendarSample currentWeek={currentWeek} />
          <p>你、孩子、另一半、父母，各有一张时间页。把它们按日历并排，同一周里的日常就能相遇。</p>
          <p class="local-note">没有账号。内容只存这个浏览器，换设备前请导出备份。</p>
        </section>
      ) : (
        <>
          {needBackup && <button type="button" class="notice warn" onClick={() => go('/backup')}>{backupAge === null ? '尚未导出备份' : `上次导出在 ${backupAge} 天前`}。新记录只存本机，留一份副本 ↗</button>}
          <ul class="people">
            {lives.map((life, index) => {
              const last = lastLivedWeek(life, currentWeek)
              const entry = getEntry(life.id, last)
              const split = life.name.search(/[（(]/)
              const name = split > 0 ? life.name.slice(0, split) : life.name
              const qualifier = split > 0 ? life.name.slice(split) : ''
              return (
                <li class="person-page" key={life.id} style={{ '--person-ink': themeHex(life.color) }}>
                  <div class="person-index"><span class="folio">{String(index + 1).padStart(2, '0')}</span><h2 data-long={name.length > 3}>{name}</h2><p class="relation">{RELATION_LABEL[life.relation]} · {ageLabel(life, today)}</p><p class="birth-signature"><span>{life.birthDate.replaceAll('-', '.')}</span><br />出生{life.endDate && <><br />{life.endDate.replaceAll('-', '.')} 离开</>}</p><button type="button" class="link-btn" onClick={() => go(`/life/${life.id}`)}>翻开 ↗</button></div>
                  <div class="person-time"><p class="time-readout">已走过 {fmt(last - birthWeek(life) + 1)} 周</p><p class="hint">{life.birthDate.slice(0, 4)} — {(life.endDate ?? today).slice(0, 4)} · 每行一岁</p><button type="button" class="weave-open" aria-label={`翻开${life.name}的时间页`} onClick={() => go(`/life/${life.id}`)}><TimeWeave life={life} today={today} currentWeek={currentWeek} entries={st.entries.get(life.id)} /></button><p class="weave-key"><i class="current-key" />{life.endDate ? '最后一周' : '当前周'} · {formatWeekRange(last)}</p></div>
                  {qualifier && <p class="person-name-note">{life.name}</p>}
                  <div class="person-record"><span class="record-pin" />{entry?.text ? <p>{entry.text}</p> : entry?.milestone || entry?.emoji || entry?.color || entry?.met ? <p>{[entry.emoji, entry.milestone, entry.met ? '这周见到了' : null].filter(Boolean).join(' · ') || '记下了这一周的颜色'}</p> : <p class="muted">{life.endDate ? '这一周还没有记下回忆。' : '这一周还没有留下句子。'}</p>}</div>
                </li>
              )
            })}
          </ul>
          <div class="home-actions"><button type="button" class="btn" onClick={() => go('/person/new')}>添加一张时间页 ＋</button>{lives.length >= 2 && <button type="button" class="btn primary" onClick={() => go('/together')}>按同一周并排 ↗</button>}</div>
        </>
      )}
      <TabBar active="home" />
      <p class="foot muted">周一至周日，是这里的一格。所有记录只存本机。</p>
    </div>
  )
}
