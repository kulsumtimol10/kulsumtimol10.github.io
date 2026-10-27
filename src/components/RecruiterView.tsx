import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { certifications, coreStack, education, experience, profile, projects, skills } from '../content';
import { Icon } from './Icon';

const SECTIONS = [
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'education', label: 'Education' },
  { id: 'certifications', label: 'Certifications' },
];

const STATS = [
  { v: '3.8', l: 'GPA, Seneca Polytechnic' },
  { v: '9.13', l: 'CGPA, BSc IT with distinction' },
  { v: '2', l: 'full-stack developer roles' },
  { v: '6', l: 'projects built' },
  { v: '6', l: 'certifications' },
  { v: '3', l: 'languages spoken' },
];

/** The whole resume on one designed page, for recruiters in a hurry and for devices without WebGL. */
export function RecruiterView({ onClose, poster }: { onClose?: () => void; poster?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState('experience');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    root.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = '';
      removeEventListener('keydown', key);
    };
  }, [onClose]);

  // Highlight the section currently being read in the top bar.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id.replace('rv-', ''))),
      { root: el, rootMargin: '-35% 0px -60% 0px' },
    );
    SECTIONS.forEach((s) => { const n = document.getElementById(`rv-${s.id}`); if (n) io.observe(n); });
    return () => io.disconnect();
  }, []);

  const jump = (id: string) => document.getElementById(`rv-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      location.href = `mailto:${profile.email}`;
    }
  };

  return (
    <div className="rv" ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${profile.name}, resume`}>
      <header className="rv-bar">
        <div className="rv-bar-in">
          <span className="rv-mark" aria-hidden="true">KT</span>
          <nav aria-label="Resume sections">
            {SECTIONS.map((s) => (
              <button key={s.id} className={active === s.id ? 'on' : ''} onClick={() => jump(s.id)}>{s.label}</button>
            ))}
          </nav>
          <div className="rv-bar-actions">
            {onClose && (
              <button className="rv-btn ghost" onClick={onClose}><Icon name="city" size={16} /> <span>3D city</span></button>
            )}
            <a className="rv-btn gold" href={profile.resume} download><Icon name="download" size={16} /> <span>PDF</span></a>
          </div>
        </div>
      </header>

      <section className="rv-hero">
        {poster && <div className="rv-hero-bg" style={{ '--poster': `url(${poster})` } as CSSProperties} aria-hidden="true" />}
        <div className="rv-hero-in">
          <div className="rv-intro">
            <p className="rv-kicker">{profile.role} · {profile.city}</p>
            <h1>{profile.name}</h1>
            <p className="rv-summary">{profile.summary}</p>
            <p className="rv-avail"><i aria-hidden="true" /> Available now · Toronto or remote</p>
            <div className="rv-contact">
              <button className="rv-btn light" onClick={copy}>
                <Icon name={copied ? 'check' : 'mail'} size={16} /> {copied ? 'Email copied' : profile.email}
              </button>
              <a className="rv-btn glass" href={profile.linkedin} target="_blank" rel="noreferrer"><Icon name="person" size={16} /> LinkedIn</a>
              <a className="rv-btn glass" href={profile.github} target="_blank" rel="noreferrer"><Icon name="code" size={16} /> GitHub</a>
            </div>
          </div>
          <dl className="rv-stats">
            {STATS.map((s) => (
              <div key={s.l}><dt>{s.l}</dt><dd>{s.v}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      <main className="rv-paper">
        <section id="rv-experience" className="rv-sec">
          <h2><span>01</span>Experience</h2>
          <ol className="rv-timeline">
            {experience.map((j) => (
              <li key={j.id}>
                <div className="rv-when"><b>{j.dates}</b><span><Icon name="pin" size={13} /> {j.place}</span></div>
                <div className="rv-job">
                  <h3>{j.role}</h3>
                  <p className="rv-org">{j.org}</p>
                  <ul>{j.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                  {j.stack.length > 0 && <div className="rv-tags">{j.stack.map((t) => <span key={t}>{t}</span>)}</div>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="rv-projects" className="rv-sec">
          <h2><span>02</span>Projects</h2>
          <div className="rv-projects">
            {projects.map((p) => (
              <article key={p.id} className={`rv-proj ${p.featured ? 'feat' : ''}`} style={{ '--c': p.accent } as CSSProperties}>
                <div className="rv-proj-head">
                  <span className="rv-proj-icon"><Icon name={p.icon} size={20} /></span>
                  <span className="rv-proj-kind">{p.kind}</span>
                  {p.featured && <span className="rv-badge">Featured</span>}
                </div>
                <h3>{p.title}</h3>
                <p>{p.blurb}</p>
                {p.bullets.length > 0 && <ul>{p.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
                <div className="rv-tags">{p.stack.map((t) => <span key={t}>{t}</span>)}</div>
                {p.link && (
                  <a className="rv-proj-link" href={p.link.href} target="_blank" rel="noreferrer">{p.link.label} <Icon name="external" size={14} /></a>
                )}
              </article>
            ))}
          </div>
        </section>

        <section id="rv-skills" className="rv-sec">
          <h2><span>03</span>Skills</h2>
          <div className="rv-core">
            <p>Core stack</p>
            <div>{coreStack.map((t) => <span key={t}>{t}</span>)}</div>
          </div>
          <div className="rv-skills">
            {skills.map((g) => (
              <div key={g.group}>
                <h3>{g.group}</h3>
                <div className="rv-tags">{g.items.map((t) => <span key={t}>{t}</span>)}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="rv-education" className="rv-sec">
          <h2><span>04</span>Education</h2>
          <div className="rv-edu">
            {education.map((e) => (
              <article key={e.school}>
                <div className="rv-score"><b>{e.score}</b><span>{e.scoreLabel}</span></div>
                <div>
                  <h3>{e.credential}</h3>
                  <p className="rv-org">{e.school} · {e.place}</p>
                  <p className="rv-dates">{e.dates}</p>
                  {e.notes.length > 0 && <ul>{e.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="rv-certifications" className="rv-sec">
          <h2><span>05</span>Certifications</h2>
          <ul className="rv-certs">
            {certifications.map((c) => (
              <li key={c.name}>
                <span className="rv-issuer" data-issuer={c.issuer}>{c.issuer}</span>
                <b>{c.name}</b>
                <small>{c.year}</small>
              </li>
            ))}
          </ul>
        </section>

        <footer className="rv-foot">
          <div>
            <h2>Let's talk.</h2>
            <p>Open to full-stack and developer roles in Toronto or remote. References available on request.</p>
          </div>
          <div className="rv-foot-actions">
            <a className="rv-btn gold" href={`mailto:${profile.email}`}><Icon name="mail" size={16} /> Email Kulsum</a>
            {onClose && <button className="rv-btn glass" onClick={onClose}><Icon name="city" size={16} /> Walk through the 3D city</button>}
          </div>
        </footer>
      </main>
    </div>
  );
}
