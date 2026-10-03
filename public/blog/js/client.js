export const PROJECT_ID = "7yw7nuh8";
export const DATASET = "production";
export const API_VERSION = "2024-01-01";

const BASE = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`;

export async function sanityQuery(query) {
  const url = `${BASE}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sanity fetch failed: ${res.status}`);
  const { result } = await res.json();
  return result;
}

export function portableTextToHtml(blocks) {
  if (!blocks) return "";
  return blocks.map(block => {
    if (block._type === "image") {
      const url = `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${block.asset._ref
        .replace("image-", "").replace("-jpg", ".jpg").replace("-png", ".png")
        .replace("-webp", ".webp")}`;
      return `<figure><img src="${url}" alt="${block.alt ?? ""}" loading="lazy" /></figure>`;
    }
    if (block._type !== "block") return "";
    const text = (block.children ?? [])
      .map(child => {
        let t = escapeHtml(child.text ?? "");
        if (child.marks?.includes("strong")) t = `<strong>${t}</strong>`;
        if (child.marks?.includes("em")) t = `<em>${t}</em>`;
        if (child.marks?.includes("code")) t = `<code>${t}</code>`;
        if (child._type === "link" && child.href) {
          t = `<a href="${child.href}" target="_blank" rel="noopener">${t}</a>`;
        }
        return t;
      })
      .join("");
    const style = block.style || "normal";
    const tag = style.startsWith("h") ? style : style === "blockquote" ? "blockquote" : "p";
    return `<${tag}>${text}</${tag}>`;
  }).join("\n");
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function imageUrl(ref, width = 1600) {
  if (!ref) return "";
  const path = ref.replace("image-", "").replace("-jpg", ".jpg")
                   .replace("-png", ".png").replace("-webp", ".webp");
  return `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${path}?w=${width}&auto=format`;
}