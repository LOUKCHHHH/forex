import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock3, LoaderCircle, Moon, ShieldAlert, Sun, Globe2 } from 'lucide-react';

const sessions = [
  { name: 'Sydney', zone: 'Australia/Sydney', open: 8, close: 16 },
  { name: 'Tokyo', zone: 'Asia/Tokyo', open: 9, close: 18 },
  { name: 'London', zone: 'Europe/London', open: 8, close: 16 },
  { name: 'New York', zone: 'America/New_York', open: 8, close: 17 },
];

function localParts(date, zone) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]));
}

function isSessionOpen(session, now) {
  const local = localParts(now, session.zone);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(local.weekday);
  const minutes = Number(local.hour) * 60 + Number(local.minute);
  const localSession = day >= 1 && day <= 5 && minutes >= session.open * 60 && minutes < session.close * 60;
  const ny = localParts(now, 'America/New_York');
  const nyDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(ny.weekday);
  const nyMinutes = Number(ny.hour) * 60 + Number(ny.minute);
  const forexWeek = (nyDay === 0 && nyMinutes >= 17 * 60) || (nyDay >= 1 && nyDay <= 4) || (nyDay === 5 && nyMinutes < 17 * 60);
  return localSession && forexWeek;
}

export function MarketConditionsPage({ pairs, pair, setPair }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetch(`/api/news?pair=${encodeURIComponent(pair.code)}&source=forexfactory`)
      .then(async response => {
        const type = response.headers.get('content-type') || '';
        if (!type.includes('application/json')) throw new Error('Calendar API unavailable. Start the app with npm run dev or open the Vercel deployment.');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load scheduled events.');
        return data.articles || [];
      })
      .then(data => { if (active) setEvents(data); })
      .catch(err => { if (active) setError(err.message || 'Could not load scheduled events.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pair.code, refreshKey]);

  const upcoming = useMemo(() => events.map(event => ({ ...event, timestamp: Date.parse(event.publishedAt) }))
    .filter(event => Number.isFinite(event.timestamp) && event.timestamp >= now.getTime() && event.timestamp <= now.getTime() + 24 * 60 * 60 * 1000)
    .sort((a, b) => a.timestamp - b.timestamp), [events, now]);
  const eventWindow = useMemo(() => events.map(event => ({ ...event, timestamp: Date.parse(event.publishedAt) }))
    .filter(event => Number.isFinite(event.timestamp) && event.timestamp >= now.getTime() - 30 * 60 * 1000 && event.timestamp <= now.getTime() + 3 * 60 * 60 * 1000), [events, now]);
  const highSoon = eventWindow.find(event => event.impact === 'high' && event.timestamp < now.getTime() + 30 * 60 * 1000);
  const highNearby = upcoming.find(event => event.impact === 'high' && event.timestamp < now.getTime() + 3 * 60 * 60 * 1000);
  const mediumSoon = upcoming.find(event => event.impact === 'medium' && event.timestamp < now.getTime() + 60 * 60 * 1000);
  const outlook = highSoon
    ? { level: 'high', title: 'High event risk', action: highSoon.timestamp < now.getTime() ? 'A high-impact release just occurred; market reaction may continue.' : 'Consider staying out around this release.', event: highSoon }
    : highNearby || mediumSoon
      ? { level: 'elevated', title: 'Elevated event risk', action: 'An impactful release is approaching. Stay alert.', event: highNearby || mediumSoon }
    : { level: 'lower', title: 'Lower scheduled event risk', action: 'No high-impact release is scheduled in the next 3 hours.', event: null };

  return <>
    <div className="date-line">MARKET RISK SNAPSHOT <span>·</span> {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(now)}</div>
    <h1>Market conditions<span>.</span></h1>
    <p className="intro">Scheduled event risk for {pair.name}. Select a market to update the outlook.</p>
    <section className="panel market-choice"><div className="section-title"><div><small>SELECT MARKET</small><h2>{pair.flags} {pair.code}</h2></div><span className="pair-count">{pairs.length} MARKETS</span></div>
      <label className="market-native-select"><span>MARKET</span><select value={pair.code} onChange={e => setPair(pairs.find(item => item.code === e.target.value) || pairs[0])}>{pairs.map(item => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label>
    </section>
    {loading ? <div className="state"><LoaderCircle className="spin" size={22}/><b>Loading scheduled events…</b><span>Checking Forex Factory's weekly calendar for {pair.code}.</span></div>
      : error ? <div className="state error"><b>Event risk unavailable</b><span>{error}</span><button onClick={() => setRefreshKey(key => key + 1)}>Try again</button></div> : <>
        <section className={`conditions-card condition-${outlook.level}`}><div className="conditions-icon"><ShieldAlert size={24}/></div><div><small>SCHEDULED EVENT OUTLOOK · NEXT 3 HOURS</small><h2>{outlook.title}</h2><p>{outlook.action}</p>{outlook.event && <div className="condition-event"><b>{outlook.event.eventCurrency} · {outlook.event.title}</b><span>{new Date(outlook.event.timestamp).toLocaleString()} · {outlook.event.impact} expected</span></div>}</div></section>
        <p className="risk-explainer conditions-note">This is an event-risk indicator based on Forex Factory's expected impact ratings. It does not measure live price volatility or liquidity and cannot determine whether a trade is safe. Always check your broker and your own trading plan.</p>
        <section className="session-panel"><div className="section-title"><div><small>NEXT 24 HOURS</small><h2>Scheduled releases</h2></div><button className="refresh-events" onClick={() => setRefreshKey(key => key + 1)}><CalendarClock size={14}/> Refresh</button></div>
          {upcoming.length ? <div className="upcoming-list">{upcoming.map(event => <article className="upcoming-event" key={event.id}><span className={`impact-badge impact-${event.impact}`}>{event.impact} expected</span><div><b>{event.eventCurrency} · {event.title}</b><small>{new Date(event.timestamp).toLocaleString()}{event.description ? ` · ${event.description}` : ''}</small></div></article>)}</div> : <p className="quiet-note">No upcoming events are listed for this market in the next 24 hours.</p>}
        </section>
      </>}
    <footer>Event ratings from the <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noreferrer">Forex Factory calendar</a>. Expected impact is not a forecast of price movement or a measure of risk to a particular trade.</footer>
  </>;
}

export function MarketSessionsPage() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(timer); }, []);
  const openCount = sessions.filter(session => isSessionOpen(session, now)).length;
  return <>
    <div className="date-line">GLOBAL FX SESSION CLOCK <span>·</span> {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(now)}</div>
    <h1>Market sessions<span>.</span></h1>
    <p className="intro">Live open or closed status for Sydney, Tokyo, London, and New York.</p>
    <section className="session-summary"><div className="summary-icon"><Globe2 size={19}/></div><div><small>FOREX WEEK STATUS</small><b>{openCount ? `${openCount} major ${openCount === 1 ? 'session is' : 'sessions are'} open` : 'Major sessions are closed'}</b><span>Broker schedules and local market holidays can differ.</span></div><span className="live-clock"><Clock3 size={13}/> {new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now)}</span></section>
    <section className="session-grid">{sessions.map(session => {
      const open = isSessionOpen(session, now);
      const local = localParts(now, session.zone);
      const clock = new Intl.DateTimeFormat('en', { timeZone: session.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
      const zone = new Intl.DateTimeFormat('en', { timeZone: session.zone, timeZoneName: 'short' }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value;
      return <article className={`session-card ${open ? 'is-open' : 'is-closed'}`} key={session.name}><div className="session-card-head"><span className="session-city-icon">{open ? <Sun size={18}/> : <Moon size={18}/>}</span><span className={`session-state ${open ? 'open' : 'closed'}`}>{open ? 'OPEN' : 'CLOSED'}</span></div><h2>{session.name}</h2><div className="session-time">{clock}<small>{zone} · {local.weekday}</small></div><div className="session-hours">Typical local hours <b>{String(session.open).padStart(2, '0')}:00–{String(session.close).padStart(2, '0')}:00</b></div></article>;
    })}</section>
    <p className="risk-explainer conditions-note">These are conventional local session windows, not official exchange hours. The global FX week is treated as open from Sunday 5:00 p.m. to Friday 5:00 p.m. New York time. Your broker may use different hours and holiday schedules.</p>
    <section className="session-panel"><div className="section-title"><div><small>SESSION HOURS</small><h2>Local trading windows</h2></div></div><p className="quiet-note">Sydney 08:00–16:00 · Tokyo 09:00–18:00 · London 08:00–16:00 · New York 08:00–17:00 local time. Clocks update for daylight saving changes.</p></section>
    <footer>Forex sessions are continuous market conventions. See <a href="https://www.forex.com/en-us/help-and-support/market-trading-hours/" target="_blank" rel="noreferrer">FOREX.com trading hours</a> or your broker for instrument-specific availability.</footer>
  </>;
}
