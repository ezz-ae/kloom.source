// Microphone / screen-capture APIs (navigator.mediaDevices) only exist on a
// *secure context* — https:// or http://localhost. Opened on a plain LAN IP over
// http (e.g. http://192.168.x.x:3000) the whole `navigator.mediaDevices` object is
// undefined, so calling `.getUserMedia()` throws "Cannot read properties of
// undefined (reading 'getUserMedia')". This guard turns that into a clear message.

/** Returns a human-readable reason if media capture is unavailable, else null. */
export function mediaDevicesUnavailable(): string | null {
  if (typeof navigator !== "undefined" && navigator.mediaDevices) return null
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Voice needs a secure connection. Open this on https:// or http://localhost — a LAN IP over http (like 192.168.x.x) blocks microphone access."
  }
  return "Audio capture isn't supported in this browser."
}
