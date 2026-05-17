import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  published: string;
  author: string;
}

interface ChannelData {
  channelId: string;
  title: string;
  handle: string | null;
  avatar: string | null;
  banner: string | null;
  description: string;
  subscriberText: string | null;
  videos: Video[];
}

function pick(re: RegExp, html: string): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

async function resolveChannel(input: string): Promise<ChannelData> {
  let url = input.trim();
  if (!/^https?:/i.test(url)) {
    // Allow raw handle like "@meditations.acepe."
    const clean = url.replace(/^@/, '');
    url = `https://www.youtube.com/@${clean}`;
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch channel page (${res.status})`);
  const html = await res.text();

  const channelId =
    pick(/"channelId":"(UC[a-zA-Z0-9_-]{20,})"/, html) ||
    pick(/<meta itemprop="(?:identifier|channelId)" content="(UC[a-zA-Z0-9_-]{20,})"/, html) ||
    pick(/channel\/(UC[a-zA-Z0-9_-]{20,})/, html);
  if (!channelId) throw new Error('Could not resolve channel ID');

  const title =
    pick(/<meta property="og:title" content="([^"]+)"/, html) ||
    pick(/<title>([^<]+)<\/title>/, html)?.replace(/ - YouTube$/, '') ||
    'YouTube Channel';

  const avatar =
    pick(/<link rel="image_src" href="([^"]+)"/, html) ||
    pick(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/, html) ||
    pick(/<meta property="og:image" content="([^"]+)"/, html);

  const banner = pick(/"banner":\{"thumbnails":\[\{"url":"([^"]+)"/, html);

  const description =
    pick(/<meta property="og:description" content="([^"]+)"/, html) || '';

  const handle =
    pick(/"canonicalChannelUrl":"https:\/\/www\.youtube\.com\/(@[^"]+)"/, html) ||
    pick(/youtube\.com\/(@[a-zA-Z0-9._-]+)/, url);

  const subscriberText =
    pick(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"/, html) ||
    pick(/"subscriberCountText":\{"simpleText":"([^"]+)"/, html);

  // Fetch recent videos via RSS (no API key required)
  const rssRes = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
  );
  const videos: Video[] = [];
  if (rssRes.ok) {
    const xml = await rssRes.text();
    const entries = xml.split('<entry>').slice(1);
    for (const entry of entries) {
      const vid = pick(/<yt:videoId>([^<]+)<\/yt:videoId>/, entry);
      const vtitle = pick(/<title>([^<]+)<\/title>/, entry);
      const published = pick(/<published>([^<]+)<\/published>/, entry) || '';
      const author = pick(/<name>([^<]+)<\/name>/, entry) || title;
      if (vid && vtitle) {
        videos.push({
          id: vid,
          title: vtitle,
          thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
          published,
          author,
        });
      }
    }
  }

  return {
    channelId,
    title,
    handle,
    avatar,
    banner,
    description,
    subscriberText,
    videos,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const input = url.searchParams.get('url') || url.searchParams.get('handle');
    if (!input || input.length > 500) {
      return new Response(JSON.stringify({ error: 'Missing or invalid url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resolveChannel(input);

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
