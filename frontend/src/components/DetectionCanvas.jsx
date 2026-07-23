import React, { useEffect, useRef } from 'react'
import { TYPE_COLOR, litterType } from '../lib/derive'

/**
 * Draws the uploaded image with detection boxes overlaid. Box color follows the
 * derived litter type so it reads the same as the rest of the dashboard.
 */
export default function DetectionCanvas({ imageSrc, detections = [], maxWidth = 760 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      canvas.width = w
      canvas.height = h

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)

      detections.forEach((d) => {
        const bx = (d.bbox?.x ?? d.bbox_x ?? 0) * scale
        const by = (d.bbox?.y ?? d.bbox_y ?? 0) * scale
        const bw = (d.bbox?.w ?? d.bbox_w ?? 0) * scale
        const bh = (d.bbox?.h ?? d.bbox_h ?? 0) * scale
        const color = TYPE_COLOR[d.type || litterType(d.class_label)] || '#3987e5'

        ctx.lineWidth = 2.5
        ctx.strokeStyle = color
        ctx.strokeRect(bx, by, bw, bh)

        const label = `${d.class_label} ${(d.confidence * 100).toFixed(0)}%`
        ctx.font = '600 12px Inter, sans-serif'
        const tw = ctx.measureText(label).width
        const ly = Math.max(0, by - 18)
        ctx.fillStyle = color
        ctx.fillRect(bx, ly, tw + 10, 18)
        ctx.fillStyle = '#fff'
        ctx.fillText(label, bx + 5, ly + 13)
      })
    }
    img.src = imageSrc
  }, [imageSrc, detections, maxWidth])

  return (
    <div className="detect-preview">
      <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }} />
    </div>
  )
}
