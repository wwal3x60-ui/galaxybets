import { apiClient } from "./client";

function photoResult(data: unknown): string | null {
  const value = data as { error?: string; profilePhoto?: unknown };
  if (value?.error) throw new Error(value.error);
  if (value?.profilePhoto === null) return null;
  if (typeof value?.profilePhoto === "string" && /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.profilePhoto)) return value.profilePhoto;
  throw new Error("INVALID_PHOTO_RESPONSE");
}
const auth = (token: string) => ({ headers: { Authorization: token } });
export async function getProfilePhoto(token: string) {
  const { data } = await apiClient.get("/user/profile-photo", auth(token));
  return photoResult(data);
}
export async function saveProfilePhoto(token: string, profilePhoto: string) {
  const { data } = await apiClient.post("/user/profile-photo", { profilePhoto }, auth(token));
  if (data?.success !== true) throw new Error(data?.error || "PHOTO_SAVE_FAILED");
  const result = photoResult(data);
  if (!result) throw new Error("INVALID_PHOTO_RESPONSE");
  return result;
}
export async function removeProfilePhoto(token: string) {
  const { data } = await apiClient.delete("/user/profile-photo", auth(token));
  if (data?.success !== true) throw new Error(data?.error || "PHOTO_REMOVE_FAILED");
  if (photoResult(data) !== null) throw new Error("INVALID_PHOTO_RESPONSE");
}
export function profileAvatarUrl(userId: string) {
  return apiClient.getUri({ url: `/user/${encodeURIComponent(userId)}/img`, params: { v: Date.now() } });
}
export function profilePhotoError(error: unknown): string {
  const e = error as { message?: string; response?: { status?: number; data?: { error?: string } } };
  if (e.response?.status === 401) return "Please log in again to change your photo.";
  if (e.response?.status === 404) return "The profile photo route was not found. Check that the backend route is installed.";
  if (e.response?.status === 413) return "The upload was too large. Select the photo again to resize it.";
  if (e.response?.status === 429) return "Too many attempts. Wait a moment before trying again.";
  const code = e.response?.data?.error || e.message;
  if (code?.startsWith("PHOTO_TOO_LARGE")) return "The resized photo is still too large. Please choose another image.";
  if (code === "INVALID_PROFILE_PHOTO") return "This image could not be read. Please choose a JPG, PNG, or WebP photo.";
  return "Could not load or save your photo. Please try again.";
}

// The backend accepts at most 48 KiB of decoded image data.
export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error("This image could not be opened. Choose another photo."); });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error("This image is too large to process. Choose a smaller photo.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not prepare this image.");
    ctx.fillStyle = "#151024";
    ctx.fillRect(0, 0, 256, 256);
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
    for (const quality of [0.85, 0.7, 0.55]) {
      let result = canvas.toDataURL("image/webp", quality);
      if (!result.startsWith("data:image/webp;")) result = canvas.toDataURL("image/jpeg", quality);
      const base64 = result.split(",")[1] || "";
      const bytes = base64.length / 4 * 3 - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
      if (bytes > 0 && bytes <= 48 * 1024) return result;
    }
    throw new Error("This photo could not be reduced enough. Choose another image.");
  } finally { URL.revokeObjectURL(url); }
}
