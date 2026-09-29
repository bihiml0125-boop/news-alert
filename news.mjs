// 키워드별 뉴스 수집 (Google News RSS → JSON)
// 같은 키워드는 CDN이 5분간 캐시하므로 사용자가 늘어도 호출량이 거의 늘지 않습니다.
const decode = (s = "") =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
   .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
   .replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();

const pick = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]) : "";
};

export default async (req) => {
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 50);
  if (!q) return Response.json({ error: "키워드(q)가 필요합니다." }, { status: 400 });

  const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:2d&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const res = await fetch(rss, { headers: { "User-Agent": "Mozilla/5.0 news-alert" } });
    if (!res.ok) throw new Error(`RSS ${res.status}`);
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 30).map(([, b]) => {
      const source = pick(b, "source");
      let title = pick(b, "title");
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
      return { title, source, link: pick(b, "link"), pubDate: new Date(pick(b, "pubDate")).toISOString() };
    });
    return Response.json({ keyword: q, items }, {
      headers: {
        "Netlify-CDN-Cache-Control": "public, durable, s-maxage=300, stale-while-revalidate=600",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    return Response.json({ error: "뉴스를 불러오지 못했습니다.", detail: String(e) }, { status: 502 });
  }
};

export const config = { path: "/api/news" };
