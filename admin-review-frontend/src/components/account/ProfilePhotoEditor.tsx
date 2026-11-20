"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@heroui/react";
import { useAuthStore } from "@/store/auth.store";
import { getProfilePhoto, saveProfilePhoto, removeProfilePhoto, prepareProfilePhoto, profileAvatarUrl, profilePhotoError } from "@/lib/api/profile-photo";

export function ProfilePhotoEditor() {
  const { user, token, hasHydrated, isAuthenticated } = useAuthStore();
  if (!hasHydrated) return <p className="text-sm text-text-muted">Loading profile photo…</p>;
  if (!user || !token || !isAuthenticated) return <p className="text-sm text-text-muted">Log in to change your profile photo.</p>;
  return <PhotoControls key={`${user.id}:${token}`} userId={String(user.id)} token={token} username={user.username || "Player"} />;
}
function PhotoControls({ userId, token, username }: { userId: string; token: string; username: string }) {
  const input = useRef<HTMLInputElement>(null), alive = useRef(true), lock = useRef(false);
  const [photo, setPhoto] = useState<string | null>(null), [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [retry, setRetry] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  function current() { const state = useAuthStore.getState(); return alive.current && state.token === token && String(state.user?.id) === userId; }
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true; setLoading(true); setLoadFailed(false); setError("");
    getProfilePhoto(token).then(value => {
      if (!active || !current()) return;
      setPhoto(value);
      useAuthStore.getState().updateUser({ avatar: profileAvatarUrl(userId) });
    }).catch(e => { if (active && current()) { setError(profilePhotoError(e)); setLoadFailed(true); } }).finally(() => { if (active && current()) setLoading(false); });
    return () => { active = false; };
  }, [token, userId, retry]);
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || lock.current || loading || !current()) return;
    lock.current = true; setPreparing(true); setError(""); setMessage("");
    try { const value = await prepareProfilePhoto(file); if (current()) setDraft(value); }
    catch (e) { if (current()) setError(e instanceof Error ? e.message : "Could not prepare this photo."); }
    finally { lock.current = false; if (current()) setPreparing(false); }
  }
  async function save() {
    if (!draft || lock.current || !current()) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const result = await saveProfilePhoto(token, draft);
      if (!current()) return;
      setPhoto(result); setDraft(null); setMessage("Profile photo saved.");
      useAuthStore.getState().updateUser({ avatar: profileAvatarUrl(userId) });
    } catch (e) { if (current()) setError(profilePhotoError(e)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function remove() {
    if (!photo || lock.current || !current() || !window.confirm("Remove your profile photo and use your initials instead?")) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await removeProfilePhoto(token);
      if (!current()) return;
      setPhoto(null); setDraft(null); setMessage("Profile photo removed.");
      useAuthStore.getState().updateUser({ avatar: profileAvatarUrl(userId) });
    } catch (e) { if (current()) setError(profilePhotoError(e)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  const disabled = loading || busy || preparing || loadFailed;
  return <section aria-label="Profile picture" className="w-full max-w-lg rounded-2xl border border-border-subtle bg-background-elevated p-4 sm:p-5">
    <h3 className="mb-4 text-sm font-semibold text-white">Profile picture</h3>
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-purple-500/40 bg-purple-500/15">
        {draft || photo ? <img src={draft || photo || ""} alt={`${username}'s profile photo${draft ? " preview" : ""}`} width={80} height={80} className="h-full w-full object-cover" /> : <span className="text-2xl font-semibold text-purple-200">{Array.from(username)[0]?.toUpperCase() || "?"}</span>}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <input ref={input} aria-label="Choose profile photo file" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={choose} className="hidden" />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" isDisabled={disabled} onPress={() => input.current?.click()} className="bg-highlight text-white">{preparing ? "Preparing…" : "Choose Photo"}</Button>
          <Button size="sm" isDisabled={disabled || !draft} onPress={() => void save()} className="bg-button-primary text-white">{busy ? "Saving…" : "Save Photo"}</Button>
          {draft && <Button size="sm" isDisabled={disabled} onPress={() => { setDraft(null); setError(""); }} className="bg-highlight text-white">Cancel</Button>}
          {photo && <Button size="sm" isDisabled={disabled} onPress={() => void remove()} className="bg-highlight text-red-300">Remove</Button>}
        </div>
        <p className="text-xs leading-relaxed text-text-muted">JPG, PNG, or WebP · Up to 5 MB. Automatically cropped and resized before upload.</p>
        {draft && <p className="text-xs text-purple-300">Preview only—click Save Photo to apply.</p>}
      </div>
    </div>
    {loading && <p role="status" className="mt-3 text-sm text-text-muted">Loading photo…</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-green-300">{message}</p>}
    {loadFailed && <Button size="sm" onPress={() => setRetry(n => n + 1)} className="mt-3 bg-highlight text-white">Try again</Button>}
  </section>;
}
