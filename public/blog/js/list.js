import { sanityQuery, imageUrl } from "./client.js";

const QUERY = `*[_type == "post"] | order(publishedAt desc) {
  title, "slug": slug.current, excerpt, cover, publishedAt, author, tags
}`;

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function card(post) {
  return `
    <a class="post-card" href="/blog/post.html?slug=${encodeURIComponent(post.slug)}">
      <div class="post-cover" style="background-image:url('${imageUrl(post.cover?.asset?._ref, 800)}')"></div>
      <div class="post-body">
        <div class="post-meta">${formatDate(post.publishedAt)} · ${post.author ?? "Nevas"}</div>
        <h2 class="post-title">${post.title}</h2>
        <p class="post-excerpt">${post.excerpt ?? ""}</p>
        ${(post.tags ?? []).length ? `<div class="post-tags">${
          post.tags.map(t => `<span>${t}</span>`).join("")
        }</div>` : ""}
      </div>
    </a>
  `;
}

(async () => {
  const el = document.getElementById("post-list");
  try {
    const posts = await sanityQuery(QUERY);
    if (!posts.length) {
      el.innerHTML = `<p class="muted">No posts yet. Check back soon.</p>`;
      return;
    }
    el.innerHTML = posts.map(card).join("");
  } catch (e) {
    console.error(e);
    el.innerHTML = `<p class="error">Could not load posts.</p>`;
  }
})();