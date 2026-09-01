let mp3EncoderReady = false;

async function mediaToolkit() {
  return import("mediabunny");
}

async function ensureMp3Encoder() {
  const media = await mediaToolkit();
  if (await media.canEncodeAudio("mp3")) return media;
  if (!mp3EncoderReady) {
    const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder");
    registerMp3Encoder();
    mp3EncoderReady = true;
  }
  return media;
}

function requireBuffer(buffer: ArrayBuffer | null) {
  if (!buffer) throw new Error("El conversor no generó datos de salida.");
  return buffer;
}

export async function convertAudioBlobToMp3(blob: Blob, bitrate = 192_000) {
  const media = await ensureMp3Encoder();
  const input = new media.Input({
    source: new media.BlobSource(blob),
    formats: media.ALL_FORMATS,
  });
  const target = new media.BufferTarget();
  const output = new media.Output({
    format: new media.Mp3OutputFormat(),
    target,
  });

  const conversion = await media.Conversion.init({
    input,
    output,
    tracks: "primary",
    video: { discard: true },
    audio: {
      bitrate,
      numberOfChannels: 2,
      sampleRate: 44_100,
      forceTranscode: true,
    },
    showWarnings: false,
  });

  if (!conversion.isValid) {
    throw new Error("No se encontró una pista de audio compatible para exportar a MP3.");
  }
  await conversion.execute();
  return new Blob([requireBuffer(target.buffer)], { type: "audio/mpeg" });
}

export async function extractAudioFromMedia(
  blob: Blob,
  options?: { start?: number; end?: number },
) {
  const media = await mediaToolkit();
  const input = new media.Input({
    source: new media.BlobSource(blob),
    formats: media.ALL_FORMATS,
  });
  const target = new media.BufferTarget();
  const output = new media.Output({
    format: new media.WavOutputFormat(),
    target,
  });

  const start = Math.max(0, options?.start || 0);
  const end = options?.end != null ? Math.max(start + 0.01, options.end) : undefined;
  const conversion = await media.Conversion.init({
    input,
    output,
    tracks: "primary",
    video: { discard: true },
    audio: {
      numberOfChannels: 2,
      sampleRate: 44_100,
      forceTranscode: true,
    },
    trim: end == null && start === 0 ? undefined : { start, end },
    showWarnings: false,
  });

  if (!conversion.isValid) {
    throw new Error("Este video no contiene una pista de audio compatible para separar.");
  }
  await conversion.execute();
  return new Blob([requireBuffer(target.buffer)], { type: "audio/wav" });
}
