export function sluggify(text) {
  if (typeof text !== "string") return "";
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getItemSlug(item) {
  if (!item) return "";
  const stored = item.system?.slug;
  if (typeof stored === "string" && stored.trim()) return sluggify(stored);
  return sluggify(item.name ?? "");
}
