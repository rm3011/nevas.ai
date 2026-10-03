import "../assets/index-BLfrN5cK.css";
import "../assets/index-DupR9Cbc.js";
import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID ?? "";
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? "";
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? "";

const targetMap: Record<string, string> = {
	home: "root",
	"about us": "about-us",
	services: "services",
	faq: "faq",
	"contact us": "contact",
};

const normalizeLabel = (label: string | null | undefined) =>
	label?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";

const scrollToSection = (id: string) => {
	const target = document.getElementById(id);
	if (!target) {
		window.scrollTo({ top: 0, behavior: "smooth" });
		return;
	}

	const offset = 90;
	const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
	window.scrollTo({ top, behavior: "smooth" });

	requestAnimationFrame(() => {
		const finalTop = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
		if (Math.abs(finalTop - window.scrollY) > 8) {
			window.scrollTo({ top: finalTop, behavior: "auto" });
		}
	});
};

const connectLink = (link: HTMLAnchorElement, targetId: string) => {
	const id = targetId.replace(/^#/, "");
	link.href = `#${id}`;
	link.onclick = (event) => {
		event.preventDefault();
		scrollToSection(id);
		history.replaceState(null, "", `#${id}`);
	};
};

const connectContactButtons = () => {
	const contactButtonLabels = [
		"schedule a meeting",
		"talk to our ai fashion experts",
		"get started",
	];

	for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("button"))) {
		if (button.form || button.dataset.contactPatched === "true") continue;

		const label = normalizeLabel(button.textContent);
		if (!contactButtonLabels.some((buttonLabel) => label.includes(buttonLabel))) continue;

		button.dataset.contactPatched = "true";
		button.addEventListener("click", (event) => {
			event.preventDefault();
			scrollToSection("contact");
			history.replaceState(null, "", "#contact");
		});
	}
};

const reorderDesktopNav = () => {
	const uls = Array.from(document.querySelectorAll("ul"));
	const desired = ["services", "about us", "contact us"];

	for (const ul of uls) {
		const items = Array.from(ul.children).filter(
			(c): c is HTMLLIElement => c.tagName === "LI",
		);
		if (items.length !== 3) continue;

		const labels = items.map((li) => normalizeLabel(li.textContent));
		if (!desired.every((label) => labels.includes(label))) continue;

		if (
			labels[0] === "services" &&
			labels[1] === "about us" &&
			labels[2] === "contact us"
		) {
			return;
		}

		const byLabel = new Map<string, HTMLLIElement>();
		items.forEach((li, index) => byLabel.set(labels[index], li));
		desired.forEach((label) => {
			const li = byLabel.get(label);
			if (li) ul.appendChild(li);
		});
		return;
	}
};

/**
 * Injects a "Blogs" link into the desktop nav bar (right after "Contact Us").
 * The new <li> is styled to match its siblings (uppercase, same gap, hover).
 */
const injectBlogNavLink = () => {
	const uls = Array.from(document.querySelectorAll("ul"));

	for (const ul of uls) {
		const items = Array.from(ul.children).filter(
			(c): c is HTMLLIElement => c.tagName === "LI",
		);
		if (items.length < 3 || items.length > 4) continue;

		const labels = items.map((li) => normalizeLabel(li.textContent));
		if (!labels.includes("services") || !labels.includes("about us")) continue;
		if (!labels.includes("contact us")) continue;

		// Already injected?
		if (labels.includes("blogs")) return;

		// Find the "Contact Us" <li> to clone its styling
		const contactLi = items.find((li) => normalizeLabel(li.textContent) === "contact us");
		if (!contactLi) return;

		// Clone the contact <li> to inherit its classes/attributes
		const blogsLi = contactLi.cloneNode(true) as HTMLLIElement;
		blogsLi.dataset.injectedBlog = "true";

		// Replace text content inside the anchor (preserves any inner wrappers)
		const anchor = blogsLi.querySelector("a");
		if (anchor) {
			anchor.textContent = "Blogs";
			anchor.setAttribute("href", "/blog/index.html");
			// Remove any onclick handler the clone might have inherited
			anchor.onclick = null;
		} else {
			// Fallback: build a plain link
			blogsLi.innerHTML = "";
			const a = document.createElement("a");
			a.textContent = "Blogs";
			a.href = "/blog/index.html";
			blogsLi.appendChild(a);
		}

		// Insert after "Contact Us"
		contactLi.insertAdjacentElement("afterend", blogsLi);
		return;
	}
};

/**
 * Injects a "Blog" link into the footer quick-links column, right after "Home".
 */
const injectBlogFooterLink = () => {
	if (document.querySelector("footer [data-injected-blog-footer]")) return;

	const footerLinks = Array.from(
		document.querySelectorAll<HTMLAnchorElement>("footer a"),
	);
	const homeLink = footerLinks.find((a) => normalizeLabel(a.textContent) === "home");
	if (!homeLink) return;

	const blogLink = document.createElement("a");
	blogLink.href = "/blog/index.html";
	blogLink.textContent = "Blog";
	blogLink.dataset.injectedBlogFooter = "true";
	blogLink.className = homeLink.className;

	homeLink.insertAdjacentElement("afterend", blogLink);
};

const removeExpertAutomationSection = () => {
	const heading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).find((element) =>
		normalizeLabel(element.textContent).includes("our expert ai automation services"),
	);

	heading?.closest("section")?.remove();
};

// ---------------------------------------------------------------------------
// BLOG SECTION INJECTION
// Reads server-rendered blog cards when available. The current blog index
// populates #post-list client-side, so the Sanity query is used as a fallback.
// ---------------------------------------------------------------------------
type BlogPost = {
	title: string;
	href: string;
	image?: string;
	date?: string;
	excerpt?: string;
};

const cacheBust = () => `?_=${Date.now()}`;

const resolveBlogUrl = (href: string) => {
	try {
		const origin = window.location.origin;
		return new URL(href, new URL("/blog/index.html", origin)).href;
	} catch {
		return new URL("/blog/", window.location.origin).href;
	}
};

const escapeHtml = (value: string) =>
	value.replace(/[&<>"']/g, (character) => {
		const entities: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;",
		};
		return entities[character] ?? character;
	});

const blogImageUrl = (element: Element) => {
	const image = element.querySelector("img");
	if (image?.getAttribute("src")) {
		return resolveBlogUrl(image.getAttribute("src") ?? "");
	}

	const cover = element.querySelector<HTMLElement>(
		'[style*="background-image"], .post-cover, .blog-cover, [class*="cover"]',
	);
	const backgroundImage = cover?.style.backgroundImage ?? "";
	const match = backgroundImage.match(/url\((?:"|')?(.*?)(?:"|')?\)/i);
	return match?.[1] ? resolveBlogUrl(match[1]) : undefined;
};

const normalizeBlogTitle = (value: string) => normalizeLabel(value);

const fetchSanityBlogPosts = async (): Promise<BlogPost[]> => {
	const projectId = "7yw7nuh8";
	const dataset = "production";
	const apiVersion = "2024-01-01";
	const query =
		'*[_type == "post" && defined(title) && defined(slug.current)] | order(publishedAt desc)[0...4] { title, "slug": slug.current, excerpt, "image": cover.asset->url, publishedAt }';
	const url = new URL(
		`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`,
	);
	url.searchParams.set("query", query);

	const response = await fetch(url.href, { cache: "no-store" });
	if (!response.ok) {
		throw new Error(`Blog content request failed: ${response.status}`);
	}

	const payload = (await response.json()) as {
		result?: Array<{
			title?: string;
			slug?: string;
			excerpt?: string;
			image?: string;
			publishedAt?: string;
		}>;
	};

	return (payload.result ?? [])
		.filter((post) => post.title && post.slug)
		.map((post) => ({
			title: post.title ?? "",
			href: resolveBlogUrl(`/blog/post.html?slug=${encodeURIComponent(post.slug ?? "")}`),
			image: post.image ? resolveBlogUrl(post.image) : undefined,
			date: post.publishedAt
				? new Date(post.publishedAt).toLocaleDateString("en-US", {
						year: "numeric",
						month: "short",
						day: "numeric",
					})
				: undefined,
			excerpt: post.excerpt,
		}));
};

const fetchLatestBlogs = async (): Promise<BlogPost[]> => {
	try {
		const response = await fetch(`/blog/index.html${cacheBust()}`, { cache: "no-store" });
		if (!response.ok) {
			throw new Error(`Blog index request failed: ${response.status}`);
		}

		const html = await response.text();
		const blogDocument = new DOMParser().parseFromString(html, "text/html");
		const posts: BlogPost[] = [];
		const seen = new Set<string>();
		const selectors = [
			"article",
			".blog-card",
			".post",
			".post-item",
			".blog-item",
			".post-card",
			'[class*="blog-card"]',
			'[class*="post-card"]',
			'[class*="post-item"]',
		];

		const addPost = (element: Element, link?: HTMLAnchorElement) => {
			const anchor =
				link ??
				(element.matches("a")
					? (element as HTMLAnchorElement)
					: element.querySelector<HTMLAnchorElement>('a[href*="/blog/"], a[href$=".html"]'));
			const heading = element.matches("h1, h2, h3, h4")
				? element
				: element.querySelector(
						"h1, h2, h3, h4, .post-title, .blog-title, [class*='title']",
					);
			const title = heading?.textContent?.trim() || anchor?.textContent?.trim() || "";
			const rawHref = anchor?.getAttribute("href");
			if (!title || !rawHref || isBlogNavigationLink(rawHref, title)) return;

			const href = resolveBlogUrl(rawHref);
			const key = new URL(href).pathname + new URL(href).search;
			if (seen.has(key)) return;
			seen.add(key);

			const excerpt = element.querySelector(
				".post-excerpt, .blog-excerpt, .excerpt, [class*='excerpt']",
			)?.textContent?.trim();
			const dateElement = element.querySelector(
				"time, .post-date, .blog-date, .date, [class*='date']",
			);
			const dateValue = dateElement?.getAttribute("datetime") || dateElement?.textContent?.trim();
			let date = dateValue || undefined;
			if (dateValue && !Number.isNaN(Date.parse(dateValue))) {
				date = new Date(dateValue).toLocaleDateString("en-US", {
					year: "numeric",
					month: "short",
					day: "numeric",
				});
			}

			posts.push({
				title,
				href,
				image: blogImageUrl(element),
				date,
				excerpt,
			});
		};

		for (const selector of selectors) {
			for (const element of Array.from(blogDocument.querySelectorAll(selector))) {
				addPost(element);
				if (posts.length === 4) break;
			}
			if (posts.length === 4) break;
		}

		if (posts.length < 4) {
			const fallbackLinks = Array.from(
				blogDocument.querySelectorAll<HTMLAnchorElement>(
					'a[href*="/blog/"], a[href$=".html"]',
				),
			);
			for (const link of fallbackLinks) {
				addPost(link, link);
				if (posts.length === 4) break;
			}
		}

		if (posts.length === 4) {
			console.info("[blog] Found four posts in the blog index HTML.");
			return posts;
		}

		try {
			const cmsPosts = await fetchSanityBlogPosts();
			if (cmsPosts.length) {
				console.info(`[blog] Loaded ${cmsPosts.length} posts from the blog content API.`);
				return cmsPosts.slice(0, 4);
			}
		} catch (error) {
			console.warn("[blog] Could not load posts from the blog content API.", error);
		}

		if (posts.length) {
			console.info(`[blog] Found ${posts.length} posts in the blog index HTML.`);
			return posts.slice(0, 4);
		}

		console.warn("[blog] No blog posts were found in the index or content API.");
		return [];
	} catch (error) {
		console.warn("[blog] Could not load /blog/index.html.", error);
		try {
			const cmsPosts = await fetchSanityBlogPosts();
			if (cmsPosts.length) {
				console.info(`[blog] Loaded ${cmsPosts.length} posts from the blog content API.`);
				return cmsPosts.slice(0, 4);
			}
		} catch (apiError) {
			console.warn("[blog] Could not load posts from the blog content API.", apiError);
		}
		return [];
	}
};

const isBlogNavigationLink = (href: string, label: string) => {
	const normalizedLabel = normalizeBlogTitle(label);
	if (["home", "about", "about us", "contact", "contact us", "services", "blog", "blogs"].includes(normalizedLabel)) {
		return true;
	}

	try {
		const url = new URL(href, new URL("/blog/index.html", window.location.origin));
		const path = url.pathname.toLowerCase().replace(/\/+$/, "");
		return path === "/blog" || path === "/blog/index.html" || path === "/";
	} catch {
		return true;
	}
};

const buildBlogSectionHTML = (posts: BlogPost[]) => `
	<section id="latest-blogs" class="relative isolate overflow-hidden bg-[#FAFAFA] py-16 px-4 sm:py-20 sm:px-6 lg:px-14 lg:py-24">
		<div aria-hidden="true" class="pointer-events-none absolute -left-40 top-0 -z-10 h-80 w-80 rounded-full bg-[#4080F5]/15 blur-[160px]"></div>
		<div aria-hidden="true" class="pointer-events-none absolute -right-40 bottom-0 -z-10 h-96 w-96 rounded-full bg-[#572AC2]/15 blur-[200px]"></div>
		<div aria-hidden="true" class="pointer-events-none absolute right-1/3 top-1/3 -z-10 h-64 w-64 rounded-full bg-[#DE8DC9]/10 blur-[160px]"></div>
		<div class="mx-auto max-w-7xl">
		<div style="max-width: 1000px; margin: 0 auto 48px; text-align: center;">
			<p style="margin: 0 0 14px; color: #572AC2; font-family: inherit; font-size: 14px; font-weight: 700; letter-spacing: 0.18em; line-height: 1.4; text-transform: uppercase;">Insights &amp; Ideas</p>
			<h2 style="margin: 0; color: #111111; font-family: inherit; font-size: clamp(34px, 5vw, 54px); font-weight: 400; letter-spacing: -0.035em; line-height: 1.15; text-transform: uppercase;">Latest From Our Blog</h2>
			<p style="max-width: 920px; margin: 24px auto 0; color: #707070; font-family: inherit; font-size: clamp(15px, 2vw, 20px); font-weight: 400; letter-spacing: 0.015em; line-height: 1.5; text-transform: uppercase;">Fresh perspectives on AI, automation, and building smarter businesses.</p>
			</div>
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
				${posts
					.map(
						(post) => `
							<article class="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#222222]/5 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#4080F5]/25 hover:shadow-lg">
								<a class="block aspect-[16/10] overflow-hidden bg-gradient-to-br from-[#4080F5]/15 via-[#24AFCD]/10 to-[#572AC2]/15" href="${escapeHtml(post.href)}" aria-label="Read ${escapeHtml(post.title)}">
									${
										post.image
											? `<img class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy" />`
											: `<span class="block h-full w-full bg-gradient-to-br from-[#4080F5]/20 via-[#24AFCD]/15 to-[#572AC2]/20"></span>`
									}
								</a>
								<div class="flex flex-1 flex-col p-5 sm:p-6">
									${post.date ? `<p class="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-[#8D8D8D]">${escapeHtml(post.date)}</p>` : ""}
									<h3 class="font-cervino text-lg font-semibold leading-6 text-[#222222] transition-colors duration-300 group-hover:text-[#4080F5] sm:text-xl">${escapeHtml(post.title)}</h3>
									${post.excerpt ? `<p class="mt-3 line-clamp-3 text-sm leading-6 text-[#666666]">${escapeHtml(post.excerpt)}</p>` : ""}
									<a class="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-[#4080F5] transition-colors duration-300 hover:text-[#572AC2]" href="${escapeHtml(post.href)}">Read More <span aria-hidden="true">&rarr;</span></a>
								</div>
							</article>
						`,
					)
					.join("")}
			</div>
			<div class="mt-10 text-center sm:mt-14">
				<a style="display: inline-flex; min-height: 58px; align-items: center; justify-content: center; padding: 0 30px; border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 14px; background: linear-gradient(135deg, #4080F5 0%, #572AC2 100%); box-shadow: 0 5px 14px rgba(64, 80, 210, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.35); color: #ffffff; font-family: inherit; font-size: 17px; font-weight: 700; letter-spacing: 0.01em; line-height: 1; text-align: center; text-decoration: none;" href="/blog/index.html">View All Blogs</a>
			</div>
		</div>
	</section>
`;

let blogInjectionInFlight = false;
let blogDiagnosticsLogged = false;

const injectBlogSection = async () => {
	if (document.getElementById("latest-blogs") || blogInjectionInFlight) return;

	if (!blogDiagnosticsLogged) {
		console.info("[blog] Looking for the FAQ and Contact sections.");
		blogDiagnosticsLogged = true;
	}

	const faqSection =
		document.getElementById("faq") ??
		Array.from(document.querySelectorAll("h2")).find(
			(heading) => normalizeLabel(heading.textContent) === "frequently asked questions",
		)?.parentElement?.parentElement;
	const contactSection = document.getElementById("contact");
	if (!faqSection || !contactSection) return;

	const position = faqSection.compareDocumentPosition(contactSection);
	if (!(position & Node.DOCUMENT_POSITION_FOLLOWING)) return;

	blogInjectionInFlight = true;
	try {
		const posts = await fetchLatestBlogs();
		if (!posts.length || document.getElementById("latest-blogs")) return;

		const section = document.createElement("div");
		section.innerHTML = buildBlogSectionHTML(posts);
		const blogSection = section.firstElementChild;
		if (!blogSection) return;

		contactSection.parentElement?.insertBefore(blogSection, contactSection);
		if (document.getElementById("latest-blogs")) {
			console.info(`[blog] Injected ${posts.length} blog cards between FAQ and Contact.`);
		}
	} finally {
		blogInjectionInFlight = false;
	}
};
// ---------------------------------------------------------------------------
// END BLOG SECTION INJECTION
// ---------------------------------------------------------------------------

const patchAgencyVideo = () => {
	const heading = Array.from(document.querySelectorAll("h2")).find(
		(element) =>
			normalizeLabel(element.textContent).replace(/\s+/g, "") ===
			"therearesomanydigitalmarketingagenciesout",
	);
	if (!heading) return;

	let carouselRoot: HTMLElement | null = heading;
	while (carouselRoot && !carouselRoot.querySelector('[class*="md:hidden"] iframe[src*="youtube.com/embed/"]')) {
		carouselRoot = carouselRoot.parentElement;
	}
	if (!carouselRoot) return;

	const videoIds = [
		"vgetmcGTvhs",
		"hbnoTaRWdMk",
		"oZ-8mKL84gM",
		"QsHtoOUO0OU",
		"FDO0-XDheXU",
	];
	const mobileFrames = Array.from(
		carouselRoot.querySelectorAll<HTMLIFrameElement>(
			'[class*="md:hidden"] iframe[src*="youtube.com/embed/"]',
		),
	);
	mobileFrames.forEach((frame, index) => {
		const videoId = videoIds[index];
		if (!videoId) return;

		const src = `https://www.youtube.com/embed/${videoId}?rel=0`;
		if (frame.src !== src) frame.src = src;
		frame.title = `Nevas AI Short ${index + 1}`;
	});

	const desktopCards = Array.from(
		carouselRoot.querySelectorAll<HTMLButtonElement>('[class*="md:flex"] > button'),
	);
	desktopCards.forEach((card, index) => {
		const videoId = videoIds[index];
		if (!videoId) return;

		const title = `Nevas AI Short ${index + 1}`;
		const desktopFrame = card.querySelector<HTMLIFrameElement>("iframe");
		if (desktopFrame) {
			const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0`;
			if (desktopFrame.src !== src) desktopFrame.src = src;
			desktopFrame.title = title;
		}

		const thumbnail = card.querySelector<HTMLImageElement>("img");
		if (thumbnail) {
			const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
			if (thumbnail.src !== thumbnailUrl) thumbnail.src = thumbnailUrl;
			thumbnail.alt = title;
		}
	});
};

const patchAboutHeading = () => {
	const heading = document.querySelector<HTMLElement>(
		".about-us-sec .about-content .sec-title h2.title",
	);
	if (!heading) return;

	const headingText = normalizeLabel(heading.textContent).replace(/\s+/g, " ");
	if (
		headingText ===
		"pioneers in artificial intelligence solutions and innovation"
	) {
		heading.textContent = "Pioneers in AI solutions & innovation";
		heading.style.wordBreak = "normal";
		heading.style.overflowWrap = "normal";
		heading.style.hyphens = "none";
	}

	const intro = heading.parentElement?.querySelector(":scope > p");
	if (intro && normalizeLabel(intro.textContent).startsWith("at aido,")) {
		intro.textContent = intro.textContent?.replace("At AiDo,", "At Nevas AI,") ?? "";
	}
};

const removeTestimonialAttribution = () => {
	const testimonialCard = Array.from(
		document.querySelectorAll<HTMLElement>('[class*="bg-black"][class*="rounded-3xl"]'),
	).find((card) =>
		Array.from(card.querySelectorAll("p")).some((paragraph) =>
			normalizeLabel(paragraph.textContent).includes("the level of innovation and execution"),
		),
	);
	if (!testimonialCard) return;

	for (const paragraph of Array.from(testimonialCard.querySelectorAll("p"))) {
		const text = paragraph.textContent?.trim() ?? "";
		if (
			paragraph.classList.contains("opacity-80") ||
			/^(?:-|–|—|â€“)\s*/.test(text)
		) {
			paragraph.remove();
		}
	}
};

const wireNavigation = () => {
	removeExpertAutomationSection();
	patchAgencyVideo();
	patchAboutHeading();
	removeTestimonialAttribution();
	connectContactButtons();
	const servicesSection = document.getElementById("solutions");
	if (servicesSection) servicesSection.id = "services";
	const aboutSection = document.getElementById("digital-agencies");
	if (aboutSection) aboutSection.id = "about-us";
	reorderDesktopNav();

	// Blog link injection (desktop nav + footer)
	injectBlogNavLink();
	injectBlogFooterLink();

	const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"));
	for (const link of links) {
		const label = normalizeLabel(link.textContent);
		const targetId = targetMap[label];
		if (!targetId) continue;
		connectLink(link, targetId);
	}

	const aboutHeading = Array.from(document.querySelectorAll("h2")).find((heading) =>
		heading.textContent?.toLowerCase().includes("there are so many digital"),
	);
	if (aboutHeading) {
		const existingAbout = document.getElementById("about-us");
		if (existingAbout && existingAbout !== aboutHeading) existingAbout.removeAttribute("id");
		aboutHeading.id = "about-us";
	}

	const faqHeading = Array.from(document.querySelectorAll("h2")).find((heading) =>
		normalizeLabel(heading.textContent) === "frequently asked questions",
	);
	if (faqHeading) {
		const faqSection = faqHeading.parentElement?.parentElement;
		if (faqSection && !faqSection.id) faqSection.id = "faq";
	}

	const fallbackAbout = document.getElementById("about-us") ?? document.getElementById("digital-agencies");
	if (fallbackAbout && !fallbackAbout.id) {
		fallbackAbout.id = "about-us";
	}
};

const interceptContactForm = () => {
	const form = Array.from(document.querySelectorAll("form")).find(
		(f) => f.querySelector('textarea[name="message"]') && f.querySelector('input[name="email"]'),
	) as HTMLFormElement | null;

	if (!form || form.dataset.patched === "true") return;
	form.dataset.patched = "true";

	form.addEventListener(
		"submit",
		async (event) => {
			event.preventDefault();
			event.stopImmediatePropagation();

			const submitBtn = form.querySelector("button") as HTMLButtonElement | null;
			const originalText = submitBtn?.textContent ?? "Send Message";
			const payload = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
			const emailParams = {
				from_name: `${payload.firstName ?? ""} ${payload.lastName ?? ""}`.trim(),
				from_email: payload.email ?? "",
				phone: payload.phone ?? "",
				message: payload.message ?? "",
			};

			if (submitBtn) {
				submitBtn.disabled = true;
				submitBtn.textContent = "Sending...";
			}

			try {
				if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
					throw new Error("EmailJS configuration is missing.");
				}

				await emailjs.send(
					EMAILJS_SERVICE_ID,
					EMAILJS_TEMPLATE_ID,
					emailParams,
					{ publicKey: EMAILJS_PUBLIC_KEY },
				);

				if (submitBtn) submitBtn.textContent = "Message Sent";
			} catch (error) {
				console.error("Contact form submission failed:", error);
				if (submitBtn) submitBtn.textContent = "Try Again";
			}
			finally {
				if (submitBtn) {
					window.setTimeout(() => {
						submitBtn.disabled = false;
						submitBtn.textContent = originalText;
					}, 2500);
				}
			}
		},
		true,
	);
};

const init = () => {
	const root = document.getElementById("root");
	if (!root) {
		window.setTimeout(init, 500);
		return;
	}

	const runPatches = () => {
		connectContactButtons();
		wireNavigation();
		interceptContactForm();
		void injectBlogSection();
	};

	runPatches();

	let blogRetries = 0;
	const blogRetryTimer = window.setInterval(() => {
		blogRetries += 1;
		void injectBlogSection();
		if (document.getElementById("latest-blogs") || blogRetries >= 20) {
			window.clearInterval(blogRetryTimer);
		}
	}, 500);

	const observer = new MutationObserver(() => {
		runPatches();
	});
	observer.observe(root, { childList: true, subtree: true });
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
	init();
}