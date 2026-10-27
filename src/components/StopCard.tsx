import { useEffect, useState } from 'react';
import { profile, type Stop } from '../content';

/** The chapter card. It fades out while the camera travels and back in when it arrives. */
export function StopCard({ stop }: { stop: Stop | null }) {
  const [shown, setShown] = useState<Stop | null>(stop);
  const [visible, setVisible] = useState(!!stop);

  useEffect(() => {
    if (stop?.id === shown?.id && stop) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const t = setTimeout(() => {
      setShown(stop);
      setVisible(!!stop);
    }, 260);
    return () => clearTimeout(t);
  }, [stop, shown]);

  if (!shown) return null;
  return (
    <article className={`card glass ${visible ? 'in' : ''}`} aria-live="polite">
      <p className="kicker">{shown.kicker}</p>
      <h2>{shown.title}</h2>
      <p>{shown.body}</p>
      {shown.bullets && (
        <ul>
          {shown.bullets.map((b) => <li key={b}>{b}</li>)}
        </ul>
      )}
      {shown.chips && (
        <div className="chips">
          {shown.chips.map((c) => <span key={c}>{c}</span>)}
        </div>
      )}
      {shown.link && (
        <div className="actions">
          <a className="btn glass" href={shown.link.href} target="_blank" rel="noreferrer">{shown.link.label} ↗</a>
        </div>
      )}
      {shown.contact && (
        <div className="actions">
          <a className="btn primary" href={`mailto:${profile.email}`}>Email Kulsum</a>
          <a className="btn glass" href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
          <a className="btn glass" href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
          <a className="btn glass" href={profile.resume} download>Resume</a>
        </div>
      )}
    </article>
  );
}
