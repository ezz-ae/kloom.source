// Server-side face quality gate (@vladmandic/face-api on the WASM backend — no
// native tfjs). A good portrait has exactly ONE confident face; this rejects the
// rare broken gen (no face / two faces / artifacted text) so it never gets cached.
//
// FAIL-OPEN by design: any setup or runtime error returns `true` ("clean"), so the
// validator can never block or break generation — worst case it just doesn't filter.

import * as faceapi from "@vladmandic/face-api/dist/face-api.node-wasm.js"
import * as tf from "@tensorflow/tfjs"
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm"
import * as canvas from "@napi-rs/canvas"
import path from "path"

/* eslint-disable @typescript-eslint/no-explicit-any */

const STRONG = 0.6                                   // score above which a detection is a real face
const ASSETS = path.join(process.cwd(), "face-assets")

let ready: Promise<boolean> | null = null
function init(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      setWasmPaths(path.join(ASSETS, "wasm") + "/")
      faceapi.env.monkeyPatch({ Canvas: canvas.Canvas, Image: canvas.Image, ImageData: canvas.ImageData } as any)
      await tf.setBackend("wasm"); await tf.ready()
      await faceapi.nets.tinyFaceDetector.loadFromDisk(path.join(ASSETS, "model"))
      return true
    })().catch(() => false)   // model/wasm unavailable → validator disabled (fail-open)
  }
  return ready
}

/** How many confident faces are in the image (0 if the validator can't run). */
export async function countFaces(buf: Buffer): Promise<number> {
  const img = await canvas.loadImage(buf)
  const c = canvas.createCanvas(img.width, img.height)
  const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height)
  const rgb = new Uint8Array(width * height * 3)
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) { rgb[j] = data[i]; rgb[j + 1] = data[i + 1]; rgb[j + 2] = data[i + 2] }
  const t = tf.tensor3d(rgb, [height, width, 3])
  try {
    const dets = (await faceapi.detectAllFaces(t as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))) as Array<{ score: number }>
    return dets.filter((d) => d.score >= STRONG).length
  } finally { t.dispose() }
}

/** True if the image is a single clean human face — or if the validator is unavailable. */
export async function isCleanPortrait(buf: Buffer): Promise<boolean> {
  try {
    if (!(await init())) return true
    return (await countFaces(buf)) === 1
  } catch { return true }
}
