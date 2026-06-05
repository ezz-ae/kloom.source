"use client"

import { useState, useRef, useCallback } from "react"
import { Image as ImageIcon, Video, FileText, X, Upload, Monitor, Camera } from "lucide-react"
import { mediaDevicesUnavailable } from "@/lib/media"

export interface MediaAttachment {
  id: string
  type: "image" | "video" | "file" | "screen"
  url: string
  name: string
  mimeType: string
  size?: number
}

interface MediaUploaderProps {
  onAttach: (att: MediaAttachment) => void
  onScreenShare?: (stream: MediaStream) => void
}

export function MediaUploader({ onAttach, onScreenShare }: MediaUploaderProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const type: MediaAttachment["type"] =
          file.type.startsWith("image/") ? "image" :
          file.type.startsWith("video/") ? "video" : "file"
        onAttach({
          id:       `${Date.now()}-${Math.random()}`,
          type,
          url:      e.target?.result as string,
          name:     file.name,
          mimeType: file.type,
          size:     file.size,
        })
      }
      reader.readAsDataURL(file)
    })
  }

  const startScreenShare = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert(mediaDevicesUnavailable() ?? "Screen share isn't supported in this browser.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as MediaTrackConstraints,
        audio: false,
      })
      onScreenShare?.(stream)
      // Capture a frame
      const video = document.createElement("video")
      video.srcObject = stream
      video.play()
      video.onloadeddata = () => {
        const canvas = document.createElement("canvas")
        canvas.width  = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext("2d")!.drawImage(video, 0, 0)
        const url = canvas.toDataURL("image/png")
        stream.getTracks().forEach((t) => t.stop())
        onAttach({ id: `ss-${Date.now()}`, type: "screen", url, name: "Screen capture", mimeType: "image/png" })
      }
    } catch {}
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} type="file" className="hidden" multiple accept="image/*,video/*,application/pdf"
        onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      <button onClick={() => inputRef.current?.click()}
        title="Attach image or file"
        className="p-2 rounded-xl text-foreground/40 hover:text-foreground/80 hover:bg-white/8 transition-all">
        <ImageIcon size={17} />
      </button>
      <button onClick={startScreenShare}
        title="Share screen"
        className="p-2 rounded-xl text-foreground/40 hover:text-foreground/80 hover:bg-white/8 transition-all">
        <Monitor size={17} />
      </button>
    </div>
  )
}

export function AttachmentPreview({ att, onRemove }: { att: MediaAttachment; onRemove: () => void }) {
  return (
    <div className="relative group rounded-xl overflow-hidden border border-border/50 w-20 h-20 shrink-0">
      {att.type === "image" || att.type === "screen" ? (
        <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
      ) : att.type === "video" ? (
        <video src={att.url} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center gap-1 p-2">
          <FileText size={20} className="text-foreground/40" />
          <span className="text-[9px] text-foreground/40 truncate w-full text-center">{att.name}</span>
        </div>
      )}
      <button onClick={onRemove}
        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <X size={10} className="text-foreground" />
      </button>
    </div>
  )
}

export function AttachmentInMessage({ att }: { att: MediaAttachment }) {
  return (
    <div className="mt-2">
      {(att.type === "image" || att.type === "screen") && (
        <img src={att.url} alt={att.name} className="max-w-xs max-h-64 rounded-xl object-cover border border-border/50" />
      )}
      {att.type === "video" && (
        <video src={att.url} controls className="max-w-xs max-h-64 rounded-xl border border-border/50" />
      )}
      {att.type === "file" && (
        <div className="flex items-center gap-2 bg-white/5 border border-border/50 rounded-xl px-3 py-2 max-w-xs">
          <FileText size={16} className="text-foreground/40 shrink-0" />
          <span className="text-sm text-foreground/70 truncate">{att.name}</span>
        </div>
      )}
    </div>
  )
}
