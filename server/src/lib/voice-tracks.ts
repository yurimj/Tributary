/** Select one usable microphone source per participant, never screen audio.
 * MediaRecorder audio is the default: experimental PCM can be damaged even
 * when the call and the parallel MediaRecorder recording sound correct.
 */
export function selectVoiceTracks<T extends {
  participant_id: string;
  type: string;
  status: string;
}>(tracks: T[], isUsable: (track: T) => boolean): T[] {
  const voices = new Map<string, T>();
  for (const track of tracks) {
    if (track.status !== "ready" || !["camera", "pcm"].includes(track.type) || !isUsable(track)) continue;
    const previous = voices.get(track.participant_id);
    if (!previous || (track.type === "camera" && previous.type === "pcm")) {
      voices.set(track.participant_id, track);
    }
  }
  return [...voices.values()];
}
