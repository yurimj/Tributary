import assert from "node:assert/strict";
import test from "node:test";
import { selectVoiceTracks } from "../src/lib/voice-tracks.js";

const pcm = { id: "pcm", participant_id: "guest", type: "pcm", status: "ready", enhanced: 1 };
const camera = { ...pcm, id: "camera", type: "camera", enhanced: 0 };

test("parallel MediaRecorder audio wins over even enhanced PCM, regardless of arrival order", () => {
  for (const tracks of [[pcm, camera], [camera, pcm]]) {
    assert.deepEqual(selectVoiceTracks(tracks, () => true), [camera]);
  }
});

test("missing or unfinished MediaRecorder WAV falls back to available PCM", () => {
  assert.deepEqual(selectVoiceTracks([camera, pcm], t => t.id !== "camera"), [pcm]);
  assert.deepEqual(selectVoiceTracks([{ ...camera, status: "processing" }, pcm], () => true), [pcm]);
});

test("audio-only MediaRecorder tracks work and each participant appears once", () => {
  const host = { ...camera, id: "host", participant_id: "host", width: null };
  const screen = { ...camera, id: "screen", type: "screen" };
  assert.deepEqual(selectVoiceTracks([pcm, screen, camera, host], () => true), [camera, host]);
  assert.deepEqual(selectVoiceTracks([screen], () => true), []);
  assert.deepEqual(selectVoiceTracks([camera, pcm], () => false), []);
});
