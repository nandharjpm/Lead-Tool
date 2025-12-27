import fs from "fs";
const BASE_URL = "https://zapgy.com/email-finder";
const today = new Date().toISOString().split("T")[0];


const pages = [
  { url: "/email-finder", changefreq: "daily", priority: 1.0 },
  { url: "/login", changefreq: "daily", priority: 1.0 },
  { url: "/features", changefreq: "daily", priority: 1.0 },
  { url: "/pricing", changefreq: "daily", priority: 1.0 },
  { url: "/email-verification", changefreq: "daily", priority: 1.0 },
];

function generateSitemap(pages) {
  const urls = pages
    .map(page => `
  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

const sitemap = generateSitemap(pages);

fs.writeFileSync("sitemap.xml", sitemap, "utf8");

console.log("✅ sitemap.xml generated");
