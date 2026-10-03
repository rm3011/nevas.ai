import { sanityQuery, portableTextToHtml, imageUrl } from "./client.js";

function getSlug() {
  return new URLSearchParams(location.search).get("slug");
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

(async () => {
  const el = document.getElementById("post");
  const slug = getSlug();
  if (!slug) {
    el.innerHTML = `<p class="error">Missing slug.</p>`;
    return;
  }

  const QUERY = `*[_type == "post" && slug.current == $slug][0]{
    title, "slug": slug.current, excerpt, cover, publishedAt, author, tags, body
  }`;
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "");
  const query = QUERY.replace("$slug", JSON.stringify(safeSlug));

  try {
    const post = await sanityQuery(query);
    if (!post) {
      el.innerHTML = `<p class="error">Post not found.</p>`;
      return;
    }

    document.title = `${post.title} — Nevas.ai`;
    setMeta("description", post.excerpt ?? "");
    setMeta("og:title", post.title, "property");
    setMeta("og:description", post.excerpt ?? "", "property");
    if (post.cover) setMeta("og:image", imageUrl(post.cover.asset._ref, 1200), "property");

    el.innerHTML = `
      <header class="post-header">
        <p class="post-meta">${formatDate(post.publishedAt)} · ${post.author ?? "Nevas"}</p>
        <h1>${post.title}</h1>
        ${post.excerpt ? `<p class="post-lede">${post.excerpt}</p>` : ""}
        ${post.cover ? `<img class="post-cover-img" src="${imageUrl(post.cover.asset._ref, 1600)}" alt="" />` : ""}
      </header>
      <div class="post-content">
        ${portableTextToHtml(post.body)}
      </div>
      <p class="post-back"><a href="/blog/index.html">← Back to all posts</a></p>
    `;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<p class="error">Could not load post.</p>`;
  }
})();

function setMeta(name, content, attr = "name") {
  let tag = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}