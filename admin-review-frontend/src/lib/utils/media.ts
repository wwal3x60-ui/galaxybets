/** Public catalog assets only. Wallet, avatars and authenticated images stay private. */
export function optimizedCatalogImage(src: string): string {
  const match=src.match(/^(.*\/public\/)(packs|drop-images|drop-cutouts)\/([A-Za-z0-9_.-]+\.(?:png|jpe?g|webp|avif))(?:[?#].*)?$/i);
  return match?`${match[1]}optimized-v1/${match[2]}/${match[3]}.webp`:src;
}
