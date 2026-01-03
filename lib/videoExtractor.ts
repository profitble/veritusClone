import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let loaded = false

async function getFFmpeg() {
  // Only initialize in browser
  if (typeof window === 'undefined') {
    throw new Error('FFmpeg can only be used in the browser')
  }

  if (!ffmpeg) {
    ffmpeg = new FFmpeg()
  }

  if (!loaded) {
    await ffmpeg.load()
    loaded = true
  }

  return ffmpeg
}

export async function extractFramesFromVideo(
  videoUrl: string,
  onProgress?: (progress: number) => void
): Promise<string[]> {
  const ffmpegInstance = await getFFmpeg()

  const videoName = 'input.mp4'
  const framePattern = 'frame-%03d.png'

  // Use proxy endpoint for external URLs (Instagram) to avoid CORS issues
  // Blob URLs (uploaded videos) can be fetched directly
  const isBlobUrl = videoUrl.startsWith('blob:')
  const fetchUrl = isBlobUrl 
    ? videoUrl 
    : `/api/video/proxy?url=${encodeURIComponent(videoUrl)}`
  
  console.log(`[VIDEO] Downloading video${isBlobUrl ? '' : ' via proxy'}: ${videoUrl}`)
  await ffmpegInstance.writeFile(videoName, await fetchFile(fetchUrl))

  // Extract 1 frame per second, max 5 seconds (5 frames)
  console.log(`[VIDEO] Running FFmpeg extraction...`)
  await ffmpegInstance.exec([
    '-i', videoName,
    '-vf', 'fps=1',          // 1 frame per second
    '-t', '5',               // Limit to first 5 seconds
    framePattern
  ])

  const files = await ffmpegInstance.listDir('/')
  const frameFiles = (files as any[])
    .filter((f: any) => f.name && f.name.startsWith('frame-') && f.name.endsWith('.png'))
    .sort((a: any, b: any) => a.name.localeCompare(b.name))

  const frameUrls: string[] = []
  for (const file of frameFiles) {
    const data = await ffmpegInstance.readFile(file.name)
    // Cast FileData to BlobPart - FFmpeg returns Uint8Array which is compatible
    const blob = new Blob([data as BlobPart], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    frameUrls.push(url)
  }

  // Cleanup
  await ffmpegInstance.deleteFile(videoName)
  for (const file of frameFiles) {
    await ffmpegInstance.deleteFile(file.name)
  }

  console.log(`[VIDEO] Extracted ${frameUrls.length} frames`)
  return frameUrls
}

