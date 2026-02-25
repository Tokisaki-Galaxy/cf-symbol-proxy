// Windbg Symbol Proxy - Cloudflare Workers
// Proxy for Microsoft Symbol Server with caching

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const UPSTREAM_URL = env.SYMBOL_SERVER || 'https://msdl.microsoft.com/download/symbols';

    // 健康检查
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(`Symbol Proxy is running. Upstream: ${UPSTREAM_URL}`, { status: 200 });
    }

    // 只处理 GET 和 HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    const cache = caches.default;
    // 检查缓存（注意：必须绑定自定义域名！）
    let response = await cache.match(request);

    if (response) {
      console.log(`Cache Hit: ${url.pathname}`);
      return response;
    }

    console.log(`Cache Miss: ${url.pathname}`);

    // 构造请求回源
    const targetUrl = UPSTREAM_URL.replace(/\/$/, '') + url.pathname;
    const newRequest = new Request(targetUrl, {
      method: request.method,
      headers: { 'User-Agent': 'Microsoft-Symbol-Server/10.0.0.0' },
      redirect: 'follow' // 确保跟随微软的 302 重定向
    });

    try {
      response = await fetch(newRequest);

      // 分状态码处理缓存逻辑
      if (request.method === 'GET') {
        if (response.status === 200) {
          const headers = new Headers(response.headers);
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          response = new Response(response.body, { ...response, headers });
          ctx.waitUntil(cache.put(request, response.clone()));
        } 
        else if (response.status === 404) {
          const headers = new Headers(response.headers);
          headers.set('Cache-Control', 'public, max-age=3600');
          response = new Response(response.body, { ...response, headers });
          ctx.waitUntil(cache.put(request, response.clone()));
        }
      }

      return response;

    } catch (err) {
      return new Response(`Fetch Error: ${err.message}`, { status: 502 });
    }
  },
};
