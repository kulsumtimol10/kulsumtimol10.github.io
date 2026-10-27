import { useCallback, useEffect, useRef, useState } from 'react';
import { CityScene } from './scene/CityScene';
import { profile, stops } from './content';
import { StopCard } from './components/StopCard';
import { RecruiterView } from './components/RecruiterView';

function formatHour(h: number) {
  const hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60) % 60;
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}
function phaseOf(h: number) {
  if (h < 7) return 'Sunrise';
  if (h < 11) return 'Morning';
  if (h < 13) return 'Midday';
  if (h < 16.3) return 'Afternoon';
  if (h < 18.4) return 'Golden hour';
  if (h < 19.7) return 'Sunset';
  if (h < 20.6) return 'Blue hour';
  return 'Night';
}

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const clockTime = useRef<HTMLElement>(null);
  const clockPhase = useRef<HTMLElement>(null);
  const sceneRef = useRef<CityScene | null>(null);
  const maxScroll = useRef(1);
  const [load, setLoad] = useState(0);
  const [failed, setFailed] = useState(false);
  const [stopId, setStopId] = useState<string | null>('hello');
  const [recruiter, setRecruiter] = useState(false);
  const [poster, setPoster] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [explored, setExplored] = useState(false);
  const [length, setLength] = useState(18);

  const goTo = useCallback((id: string) => {
    const s = sceneRef.current;
    if (!s) return;
    scrollTo({ top: s.progressOfStop(id) * maxScroll.current, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    let scene: CityScene;
    let alive = true;
    try {
      scene = new CityScene(host.current!, labels.current!, {
        onLoad: setLoad,
        onStop: setStopId,
        onInteract: () => setExplored(true),
        onPick: (id) => goTo(id),
        // The clock changes every frame while scrolling, so it is written straight to the DOM.
        onHour: (h) => {
          if (clockTime.current) clockTime.current.textContent = formatHour(h);
          if (clockPhase.current) clockPhase.current.textContent = phaseOf(h);
        },
      });
    } catch {
      setFailed(true);
      setRecruiter(true);
      return;
    }
    sceneRef.current = scene;
    setLength(scene.rig.total);
    scene.init().then(() => alive && setPoster(scene.poster)).catch((e) => {
      if (!alive) return;
      console.error(e);
      setFailed(true);
      setRecruiter(true);
    });
    const measure = () => (maxScroll.current = Math.max(1, document.documentElement.scrollHeight - innerHeight));
    const onScroll = () => {
      scene.setScroll(scrollY / maxScroll.current);
      setScrolled(scrollY > 40);
    };
    const onResize = () => { measure(); onScroll(); };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onResize);
    measure();
    onScroll();
    return () => {
      alive = false;
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onResize);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [goTo]);

  useEffect(() => {
    maxScroll.current = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  }, [length]);

  useEffect(() => {
    sceneRef.current?.setPaused(recruiter);
  }, [recruiter]);

  const stop = stops.find((s) => s.id === stopId) ?? null;
  const ready = load >= 1;
  const touch = matchMedia('(pointer: coarse)').matches;

  return (
    <>
      <div className="stage" ref={host} aria-hidden="true" />
      <div className="labels" ref={labels} aria-hidden="true" />
      <div className="spacer" style={{ height: `${length * 100 + 100}vh` }} />

      <header className="hud">
        <a className="brand glass" href="#" onClick={(e) => { e.preventDefault(); goTo('hello'); }}>
          <span className="mark" aria-hidden="true">KT</span>
          <span><b>{profile.name}</b><small>{profile.role} · {profile.city}</small></span>
        </a>
        <div className="hud-right">
          <div className="clock glass">
            <b ref={clockTime}>{formatHour(6.9)}</b>
            <small ref={clockPhase}>Sunrise</small>
          </div>
          <button className="btn glass only-wide" onClick={() => setRecruiter(true)}>Recruiter view</button>
          <a className="btn primary only-wide" href={profile.resume} download>Resume</a>
          <button className="btn primary only-narrow" onClick={() => setRecruiter(true)}>Resume</button>
        </div>
      </header>

      <nav className="dots" aria-label="Chapters">
        {stops.map((s) => (
          <button key={s.id} className={s.id === stopId ? 'on' : ''} onClick={() => goTo(s.id)} aria-label={s.nav} aria-current={s.id === stopId}>
            <span>{s.nav}</span>
          </button>
        ))}
      </nav>

      <StopCard stop={stop} />

      <div className={`hint ${scrolled || !ready ? 'gone' : ''}`}>
        {explored ? (
          <span className="hint-scroll">Now scroll to start the tour</span>
        ) : (
          <>
            <span className="hint-drag"><i aria-hidden="true" />{touch ? 'Swipe sideways to look' : 'Drag to look around'}</span>
            <span className="hint-sep" aria-hidden="true" />
            <span className="hint-scroll">{touch ? 'Scroll for the tour' : 'Scroll to start the tour'}</span>
          </>
        )}
      </div>

      {!ready && !failed && (
        <div className="loader">
          <div>
            <p className="kicker">Toronto · {profile.name}</p>
            <h1>Building the city…</h1>
            <div className="bar"><i style={{ width: `${Math.round(load * 100)}%` }} /></div>
            <p className="muted">{Math.round(load * 100)}% · painting windows, planting trees, starting streetcars</p>
            <button className="btn glass" onClick={() => setRecruiter(true)}>Skip to recruiter view</button>
          </div>
        </div>
      )}

      {recruiter && <RecruiterView poster={poster} onClose={failed ? undefined : () => setRecruiter(false)} />}
    </>
  );
}
