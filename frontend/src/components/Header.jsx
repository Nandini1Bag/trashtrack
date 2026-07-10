import React from 'react'

const style = {
  header: {
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    borderBottom: '1px solid var(--border)',
    marginBottom: '1.25rem',
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: 'var(--teal)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.15rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  sub: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginLeft: 'auto',
  },
}

export default function Header() {
  return (
    <header style={style.header}>
      <div style={style.logo}>🗑</div>
      <span style={style.title}>TrashTrack</span>
      <span style={style.sub}>AI Litter Detection & Civic Reporting</span>
    </header>
  )
}
