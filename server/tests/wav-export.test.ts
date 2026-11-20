import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { toWav } from "../src/jobs/ffmpeg.js";

test("MediaRecorder-style WebM/Opus exports a complete non-silent 48kHz WAV", {
  skip: !process.env.FFMPEG_PATH || !process.env.FFPROBE_PATH,
}, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tributary-wav-"));
  try {
    const source = path.join(dir, "microphone.webm");
    const output = path.join(dir, "microphone.wav");
    execFileSync(process.env.FFMPEG_PATH!, ["-v", "error", "-f", "lavfi", "-i",
      "sine=frequency=440:sample_rate=48000:duration=2", "-c:a", "libopus", source]);
    await toWav(source, output);
    const metadata = JSON.parse(execFileSync(process.env.FFPROBE_PATH!, ["-v", "error",
      "-show_streams", "-of", "json", output], { encoding: "utf8" }));
    const stream = metadata.streams[0];
    assert.equal(stream.codec_name, "pcm_s16le");
    assert.equal(stream.sample_rate, "48000");
    assert.equal(stream.channels, 2);
    assert.ok(Math.abs(Number(stream.duration) - 2) < 0.02);
    const decoded = execFileSync(process.env.FFMPEG_PATH!, ["-v", "error", "-i", output,
      "-f", "s16le", "-ac", "1", "pipe:1"]);
    let energy = 0;
    for (let i = 0; i < decoded.length; i += 2) energy += decoded.readInt16LE(i) ** 2;
    assert.ok(Math.sqrt(energy / (decoded.length / 2)) > 500, "voice source must not be silent");
    assert.ok(readFileSync(output).length > 380000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
