import React, { useRef, useEffect, useState } from 'react'

const CORAL = '#e4572e'

export default function DetectionCanvas({ imageSrc, detections }) {
  const canvasRef = useRef(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      // scale to fit container (max 560px wide)
      const maxW = 560
      const scale = Math.min(1, maxW / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      canvas.width = w
      canvas.height = h
      setDims({ w, h, natW: img.width, natH: img.height, scale })

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)

      // draw bounding boxes
      detections.forEach((d) => {
        const x = d.bbox_x * scale
        const y = d.bbox_y * scale
        const bw = d.bbox_w * scale
        const bh = d.bbox_h * scale

        ctx.strokeStyle = CORAL
        ctx.lineWidth = 2.5
        ctx.strokeRect(x, y, bw, bh)

        // label
        const label = `${d.class_label} ${(d.confidence * 100).toFixed(0)}%`
        ctx.font = `bold ${Math.max(11, 13 * scale)}px Inter, sans-serif`
        const tw = ctx.measureText(label).width
        ctx.fillStyle = CORAL
        ctx.fillRect(x, Math.max(0, y - 18 * scale), tw + 8, 18 * scale)
        ctx.fillStyle = '#fff'
        ctx.fillText(label, x + 4, Math.max(13 * scale, y - 4 * scale))
      })
    }
    img.src = imageSrc
  }, [imageSrc, detections])

  return (
    <div style={{ overflow: 'auto', borderRadius: 6, background: 'var(--bg)' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', maxWidth: '100%', borderRadius: 6 }}
      />
      {detections.length === 0 && imageSrc && (
        <p style={{
          padding: '0.75rem',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}>
          No detections — expected with stock YOLOv8n weights. Fine-tune on TACO to close this gap.
        </p>
      )}
    </div>
  )
}
