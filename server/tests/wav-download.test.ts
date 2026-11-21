import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("legacy PCM WAV links serve the same participant's MediaRecorder WAV, preserving raw and authorization", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tributary-download-"));
  process.env.TRIBUTARY_DATA_DIR = dir;
  const { default: Fastify } = await import("fastify");
  const { db } = await import("../src/lib/db.js");
  const { registerMediaRoutes } = await import("../src/routes/media.js");
  const app = Fastify();
  try {
    db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)").run("owner", "test@example.test", "Owner", "unused", 0);
    db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)").run("other", "other@example.test", "Other", "unused", 0);
    for (const id of ["owner", "other"]) {
      db.prepare("INSERT INTO auth_tokens VALUES (?, ?, ?, ?)").run(id, id, 0, Date.now() + 60000);
    }
    db.prepare("INSERT INTO studios VALUES (?, ?, ?, ?)").run("studio", "owner", "Test", 0);
    db.prepare("INSERT INTO studio_members VALUES (?, ?, ?, ?)").run("studio", "owner", "owner", 0);
    db.prepare("INSERT INTO sessions (id, studio_id, title, invite_token, created_at) VALUES (?, ?, ?, ?, ?)")
      .run("session", "studio", "Test", "invite", 0);
    for (const id of ["guest", "host"]) {
      db.prepare("INSERT INTO participants (id, session_id, name, token, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(id, "session", id, id, 0);
    }
    for (const id of ["take", "other-take"]) {
      db.prepare("INSERT INTO recordings (id, session_id, started_at_ms) VALUES (?, ?, ?)").run(id, "session", 0);
    }
    const add = (id: string, participant: string, take: string, type: string) => {
      db.prepare(`INSERT INTO tracks (id, recording_id, session_id, participant_id, type, mime_type, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'ready', 0)`).run(id, take, "session", participant, type, type === "pcm" ? "audio/pcm;rate=48000;channels=2;format=s16le" : "video/webm;codecs=vp9,opus");
      fs.writeFileSync(path.join(dir, "media", `${id}.wav`), Buffer.alloc(128, id === "camera" ? 42 : 7));
    };
    add("pcm", "guest", "take", "pcm");
    add("host-camera", "host", "take", "camera");
    add("other-camera", "guest", "other-take", "camera");
    fs.writeFileSync(path.join(dir, "media", "pcm.raw.pcm"), "original pcm");
    registerMediaRoutes(app);
    const get = (kind: string, token = "owner", range?: string) => app.inject({
      url: `/api/tracks/pcm/download?kind=${kind}`,
      headers: { authorization: `Bearer ${token}`, ...(range ? { range } : {}) },
    });
    // Another participant and another take must never be substituted.
    assert.equal((await get("wav")).headers["x-tributary-audio-source"], "pcm");
    add("camera", "guest", "take", "camera");
    const response = await get("wav");
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["x-tributary-audio-source"], "camera");
    assert.equal(response.headers["cache-control"], "no-store");
    assert.match(String(response.headers["content-disposition"]), /camera/);
    assert.deepEqual(response.rawPayload, Buffer.alloc(128, 42));
    const partial = await get("wav", "owner", "bytes=0-15");
    assert.equal(partial.statusCode, 206);
    assert.deepEqual(partial.rawPayload, Buffer.alloc(16, 42));
    assert.equal((await get("wav", "other")).statusCode, 404);
    assert.equal((await get("wav", "invalid")).statusCode, 401);
    assert.equal((await get("raw")).body, "original pcm");
    assert.deepEqual(fs.readFileSync(path.join(dir, "media", "pcm.wav")), Buffer.alloc(128, 7));
    fs.unlinkSync(path.join(dir, "media", "camera.wav"));
    assert.equal((await get("wav")).headers["x-tributary-audio-source"], "pcm");
  } finally {
    await app.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
