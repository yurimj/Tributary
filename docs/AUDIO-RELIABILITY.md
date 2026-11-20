# Reliable WAV exports in this fork

This fork defaults to the microphone audio recorded by MediaRecorder (WebM/Opus
on Chrome, MP4/AAC on Safari). The server decodes that audio to a 48 kHz WAV.
Audio-only sessions use the same path; a camera is not required.

The optional AudioWorklet PCM recorder is now **off by default** and labeled
experimental. In a real recording, the PCM WAV was distorted while the parallel
WebM audio was intact. Wrapping that PCM in another WAV did not repair it;
extracting the WebM audio did. The internal cause of the PCM distortion has not
been reproduced or established, so this change does not claim to repair that
recorder. Decoding Opus/AAC to WAV does not restore lossless microphone quality.

Mixed audio, mixed video, and transcription now choose one ready MediaRecorder
WAV per participant, falling back to PCM if no usable MediaRecorder WAV exists.
An enhanced PCM file cannot override a ready MediaRecorder source. Screen audio
remains separate in mixes. Source offsets are retained to preserve synchronization.

## Existing sessions

- Download **WAV (recommended)** from the participant's **camera** row. This is
  the decoded MediaRecorder recording, separate from **audio (experimental PCM)**.
- Choose **Create mixed audio/video** again to generate an export using the new
  source policy. Previously generated exports are not rewritten.
- Existing PCM and raw files remain available and are never replaced by this fix.
- If the camera WAV is missing, use the track's retry-processing action to
  regenerate it from the retained raw recording.

## Verification

Run `pnpm --filter @tributary/server test`, `pnpm typecheck`, and `pnpm build`.
Source-selection tests cover arrival order, enhanced PCM, missing files,
unfinished tracks, audio-only recording, multiple participants, and screen audio.
With `FFMPEG_PATH` and `FFPROBE_PATH` set, the media integration test also verifies
that WebM audio decodes to a non-silent, full-length 48 kHz WAV.

Before an important session, make a short recording on the actual guest device,
download the recommended WAV, and listen to it. If both recording paths are
damaged, this source-selection change cannot reconstruct the missing audio.
