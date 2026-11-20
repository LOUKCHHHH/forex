import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock3, LoaderCircle, Moon, ShieldAlert, Sun, Globe2, Search, ChevronDown, X, Star } from 'lucide-react';

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

function relatedCurrencies(pairCode) {
  if (['XAU/USD', 'XAG/USD', 'WTI', 'BRENT', 'NASDAQ', 'S&P 500', 'DOW'].includes(pairCode)) return ['USD'];
  if (pairCode === 'USD/CNH') return ['USD', 'CNY'];
  if (pairCode === 'DAX') return ['EUR'];
  if (pairCode === 'FTSE 100') return ['GBP'];
  if (pairCode === 'NIKKEI') return ['JPY'];
  if (pairCode === 'BTC/USD') return ['BTC', 'USD'];
  if (pairCode === 'ETH/USD') return ['ETH', 'USD'];
  return pairCode.match(/[A-Z]{3}/g) || [];
}

function countdownText(milliseconds) {
  if (milliseconds <= 60 * 1000) return 'under 1 min';
  const totalMinutes = Math.floor(milliseconds / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function MarketWatchlist({ pairs, pair, watchlist, onSelect, onToggle }) {
  const pinned = watchlist.includes(pair.code);
  const markets = watchlist.map(code => pairs.find(item => item.code === code)).filter(Boolean);
  return <section className="watchlist-box"><div className="watchlist-heading"><div><small>WATCHLIST</small><b>Pinned markets</b></div><button className={`watchlist-pin ${pinned?'is-pinned':''}`} onClick={()=>onToggle(pair.code)} aria-pressed={pinned}><Star size={14} fill={pinned?'currentColor':'none'}/>{pinned?'Pinned':'Pin selected'}</button></div>{markets.length?<div className="watchlist-items">{markets.map(item=><div className="watchlist-item" key={item.code}><button className="watchlist-market" onClick={()=>onSelect(item)}><span>{item.flags}</span><b>{item.code}</b><small>{item.name}</small></button><button className="watchlist-remove" onClick={()=>onToggle(item.code)} aria-label={`Remove ${item.code} from watchlist`}><X size={13}/></button></div>)}</div>:<p className="watchlist-empty">Pin a market to make it available here.</p>}</section>;
}

export function MarketConditionsPage({ pairs, pair, setPair, watchlist, onToggleWatchlist }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [marketQuery, setMarketQuery] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(() => localStorage.getItem('fxbrief-event-alerts') === 'true');
  const [alertMessage, setAlertMessage] = useState('');
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetch('/api/forexfactory')
      .then(async response => {
        const type = response.headers.get('content-type') || '';
        if (!type.includes('application/json')) throw new Error('Calendar API unavailable. Start the app with npm run dev or open the Vercel deployment.');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load scheduled events.');
        return data.events || [];
      })
      .then(data => { if (active) setEvents(data); })
      .catch(err => { if (active) setError(err.message || 'Could not load scheduled events.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  const marketEvents = useMemo(() => {
    const currencies = new Set(relatedCurrencies(pair.code));
    return events.filter(event => currencies.has(String(event.country || '').toUpperCase())).map(event => ({
      id: `${event.country}-${event.date}-${event.title}`, title: event.title, eventCurrency: event.country,
      impact: String(event.impact || '').toLowerCase(), description: [event.forecast && `Forecast: ${event.forecast}`, event.previous && `Previous: ${event.previous}`].filter(Boolean).join(' · '),
      publishedAt: event.date,
    }));
  }, [events, pair.code]);
  const upcoming = useMemo(() => marketEvents.map(event => ({ ...event, timestamp: Date.parse(event.publishedAt) }))
    .filter(event => Number.isFinite(event.timestamp) && event.timestamp >= now.getTime() && event.timestamp <= now.getTime() + 24 * 60 * 60 * 1000)
    .sort((a, b) => a.timestamp - b.timestamp), [marketEvents, now]);
  const filteredPairs = useMemo(() => pairs.filter(item => `${item.code} ${item.name} ${item.group}`.toLowerCase().includes(marketQuery.toLowerCase())), [pairs, marketQuery]);
  const eventWindow = useMemo(() => marketEvents.map(event => ({ ...event, timestamp: Date.parse(event.publishedAt) }))
    .filter(event => Number.isFinite(event.timestamp) && event.timestamp >= now.getTime() - 30 * 60 * 1000 && event.timestamp <= now.getTime() + 3 * 60 * 60 * 1000), [marketEvents, now]);
  const highSoon = eventWindow.find(event => event.impact === 'high' && event.timestamp < now.getTime() + 30 * 60 * 1000);
  const highNearby = upcoming.find(event => event.impact === 'high' && event.timestamp < now.getTime() + 3 * 60 * 60 * 1000);
  const mediumSoon = upcoming.find(event => event.impact === 'medium' && event.timestamp < now.getTime() + 60 * 60 * 1000);
  const nextHighEvent = upcoming.find(event => event.impact === 'high');
  const outlook = highSoon
    ? { level: 'high', title: 'High event risk', action: highSoon.timestamp < now.getTime() ? 'A high-impact release just occurred; market reaction may continue.' : 'Consider staying out around this release.', event: highSoon }
    : highNearby || mediumSoon
      ? { level: 'elevated', title: 'Elevated event risk', action: 'An impactful release is approaching. Stay alert.', event: highNearby || mediumSoon }
    : { level: 'lower', title: 'Lower scheduled event risk', action: 'No high-impact release is scheduled in the next 3 hours.', event: null };

  useEffect(() => {
    if (!alertsEnabled || !nextHighEvent || !('Notification' in window) || Notification.permission !== 'granted') return;
    const timeToEvent = nextHighEvent.timestamp - now.getTime();
    const alertKey = `fxbrief-alerted-${nextHighEvent.id}`;
    if (timeToEvent > 0 && timeToEvent <= 15 * 60 * 1000 && localStorage.getItem(alertKey) !== 'true') {
      const notification = new Notification(`High-impact event in ${countdownText(timeToEvent)}`, {
        body: `${nextHighEvent.eventCurrency}: ${nextHighEvent.title}`,
        tag: alertKey,
      });
      notification.onclick = () => { window.focus(); notification.close(); };
      localStorage.setItem(alertKey, 'true');
    }
  }, [alertsEnabled, nextHighEvent?.id, now]);

  async function toggleEventAlerts() {
    setAlertMessage('');
    if (alertsEnabled) {
      localStorage.removeItem('fxbrief-event-alerts');
      setAlertsEnabled(false);
      setAlertMessage('Browser alerts are off.');
      return;
    }
    if (!('Notification' in window)) {
      setAlertMessage('This browser does not support desktop notifications.');
      return;
    }
    let permission;
    try { permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission; }
    catch { setAlertMessage('This browser only allows alerts from an installed app or supported secure page.'); return; }
    if (permission === 'granted') {
      localStorage.setItem('fxbrief-event-alerts', 'true');
      setAlertsEnabled(true);
      setAlertMessage('Alerts are on 15 minutes before high-impact events. Keep this page open.');
    } else {
      setAlertMessage('Notifications are blocked. Allow them for this site in your browser settings.');
    }
  }

  return <>
    <div className="date-line">MARKET RISK SNAPSHOT <span>·</span> {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(now)}</div>
    <h1>Market conditions<span>.</span></h1>
    <p className="intro">Scheduled event risk for {pair.name}. Select a market to update the outlook.</p>
    <MarketWatchlist pairs={pairs} pair={pair} watchlist={watchlist} onSelect={setPair} onToggle={onToggleWatchlist}/>
    <section className="panel market-choice"><div className="section-title"><div><small>SELECT MARKET</small><h2>{pair.flags} {pair.code}</h2></div><span className="pair-count">{pairs.length} MARKETS</span></div>
      <div className="market-search-picker"><span className="market-select-label">MARKET</span><button className="market-select-trigger" aria-expanded={selectorOpen} onClick={() => setSelectorOpen(value => !value)}><span><b>{pair.code}</b><small>{pair.name}</small></span>{selectorOpen ? <X size={17}/> : <ChevronDown size={17}/>}</button>{selectorOpen&&<div className="market-search-menu"><div className="market-search-input"><Search size={16}/><input autoFocus value={marketQuery} onChange={event => setMarketQuery(event.target.value)} placeholder="Search symbol or market"/><button onClick={() => setMarketQuery('')} aria-label="Clear search"><X size={14}/></button></div><div className="market-search-results">{filteredPairs.map(item=><button key={item.code} className="market-search-option" onClick={()=>{setPair(item);setSelectorOpen(false);setMarketQuery('')}}><span className="market-option-flag">{item.flags}</span><span><b>{item.code}</b><small>{item.group} · {item.name}</small></span>{item.code===pair.code&&<span className="selected-check">Selected</span>}</button>)}{!filteredPairs.length&&<p className="market-no-results">No markets match that search.</p>}</div></div>}</div>
    </section>
    {loading ? <div className="state"><LoaderCircle className="spin" size={22}/><b>Loading scheduled events…</b><span>Checking Forex Factory's weekly calendar for {pair.code}.</span></div>
      : error ? <div className="state error"><b>Event risk unavailable</b><span>{error}</span><button onClick={() => setRefreshKey(key => key + 1)}>Try again</button></div> : <>
        <section className={`conditions-card condition-${outlook.level}`} aria-live="polite"><div className="conditions-icon"><ShieldAlert size={24}/></div><div className="condition-content"><div className="condition-heading"><small>SCHEDULED EVENT OUTLOOK · NEXT 3 HOURS</small><span className="condition-level-chip"><i/> {outlook.level==='lower'?'LOWER RISK':outlook.level==='elevated'?'ELEVATED RISK':'HIGH RISK'}</span></div><h2>{outlook.title}</h2><p>{outlook.action}</p>{outlook.event && <div className="condition-event"><b>{outlook.event.eventCurrency} · {outlook.event.title}</b><span><strong>{outlook.event.impact} expected</strong> · {new Date(outlook.event.timestamp).toLocaleString()}</span></div>}</div></section>
        <p className="risk-explainer conditions-note">This is an event-risk indicator based on Forex Factory's expected impact ratings. It does not measure live price volatility or liquidity and cannot determine whether a trade is safe. Always check your broker and your own trading plan.</p>
        <section className="countdown-panel"><div className="countdown-main"><small>NEXT HIGH-IMPACT EVENT</small>{nextHighEvent?<><h2>{nextHighEvent.eventCurrency} · {nextHighEvent.title}</h2><span>{new Date(nextHighEvent.timestamp).toLocaleString()}</span></>:<h2>No high-impact event listed in the next 24 hours</h2>}</div>{nextHighEvent&&<div className="countdown-value"><b>{countdownText(nextHighEvent.timestamp-now.getTime())}</b><small>until release</small></div>}<div className="countdown-alerts"><button className={`alert-toggle ${alertsEnabled?'enabled':''}`} onClick={toggleEventAlerts}><CalendarClock size={15}/>{alertsEnabled?'Turn alerts off':'Enable browser alerts'}</button><small>{alertMessage||'Optional notification 15 minutes before high-impact releases.'}</small></div></section>
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
