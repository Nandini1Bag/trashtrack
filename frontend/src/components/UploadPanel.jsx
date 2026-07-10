import React, { useRef, useState } from 'react'

const css = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  dropzone: {
    border: '2px dashed var(--border)',
    borderRadius: 8,
    padding: '2.5rem 1.5rem',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  dropzoneActive: {
    borderColor: 'var(--teal)',
    background: 'rgba(14, 154, 167, 0.06)',
  },
  fileName: {
    fontSize: '0.85rem',
    color: 'var(--text)',
    marginTop: '0.25rem',
  },
  btn: {
    alignSelf: 'flex-start',
    background: 'var(--teal)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '0.6rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
}

export default function UploadPanel({ onFileSelect, onUpload, loading, hasFile }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [name, setName] = useState('')

  const accept = (f) => {
    if (!f) return
    setName(f.name)
    onFileSelect(f)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    accept(e.dataTransfer.files?.[0])
  }

  return (
    <div style={css.wrapper}>
      <div
        style={{ ...css.dropzone, ...(dragging ? css.dropzoneActive : {}) }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => accept(e.target.files?.[0])}
        />
        {name
          ? <p style={css.fileName}>{name}</p>
          : <p>Drop an image here or click to browse<br />(street photo, dashcam frame, drone shot)</p>
        }
      </div>

      <button
        style={{ ...css.btn, ...((!hasFile || loading) ? css.btnDisabled : {}) }}
        disabled={!hasFile || loading}
        onClick={onUpload}
      >
        {loading ? 'Detecting…' : 'Run Detection'}
      </button>
    </div>
  )
}
