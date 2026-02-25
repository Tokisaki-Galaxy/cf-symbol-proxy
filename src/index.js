// Windbg Symbol Proxy - Cloudflare Workers
// Proxy for Microsoft Symbol Server with caching

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Only handle GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Extract symbol file path from URL
    // Example: /ntdll.pdb/1234567890ABCDEF1/ntdll.pdb
    const path = url.pathname;
    
    if (path === '/' || path === '/health') {
      return handleHealthCheck();
    }

    // Check cache first
    const cacheKey = `symbol:${path}`;
    const cached = await env.SYMBOL_CACHE.get(cacheKey, { type: 'stream' });
    
    if (cached) {
      console.log(`Cache hit for: ${path}`);
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Cache': 'HIT',
          'Cache-Control': `public, max-age=${env.CACHE_TTL}`,
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    console.log(`Cache miss for: ${path}, fetching from upstream`);
    
    // Fetch from Microsoft Symbol Server
    const upstreamUrl = `${env.SYMBOL_SERVER}${path}`;
    
    try {
      const response = await fetch(upstreamUrl, {
        headers: {
          'User-Agent': 'Windbg-Symbol-Proxy/1.0',
        },
        cf: {
          cacheTtl: env.CACHE_TTL,
          cacheEverything: true,
        }
      });

      if (!response.ok) {
        console.log(`Upstream error: ${response.status} for ${upstreamUrl}`);
        return new Response('Symbol not found', { 
          status: response.status,
          headers: { 'X-Upstream-Status': response.status.toString() }
        });
      }

      // Get response body as stream
      const responseBody = response.body;
      
      // Clone the response to cache it
      const [stream1, stream2] = responseBody.tee();
      
      // Cache the response in background
      ctx.waitUntil(cacheResponse(cacheKey, stream1, env));
      
      // Return the response with caching headers
      const headers = new Headers(response.headers);
      headers.set('X-Cache', 'MISS');
      headers.set('Cache-Control', `public, max-age=${env.CACHE_TTL}`);
      headers.set('Access-Control-Allow-Origin', '*');
      
      // Remove content-encoding if present (Cloudflare will re-encode)
      headers.delete('content-encoding');
      headers.delete('Content-Encoding');
      
      return new Response(stream2, {
        status: response.status,
        headers: headers
      });
      
    } catch (error) {
      console.error(`Error fetching symbol: ${error.message}`);
      return new Response('Internal server error', { status: 500 });
    }
  }
};

async function cacheResponse(key, stream, env) {
  try {
    // Read the stream into an array buffer
    const chunks = [];
    const reader = stream.getReader();
    
    let totalSize = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      totalSize += value.length;
      
      // Check file size limit
      if (totalSize > parseInt(env.MAX_FILE_SIZE)) {
        console.log(`File too large to cache: ${totalSize} bytes`);
        return;
      }
    }
    
    // Combine chunks
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Store in KV with TTL
    await env.SYMBOL_CACHE.put(key, combined, {
      expirationTtl: parseInt(env.CACHE_TTL)
    });
    
    console.log(`Cached: ${key}, size: ${totalSize} bytes`);
    
  } catch (error) {
    console.error(`Failed to cache response: ${error.message}`);
  }
}

function handleHealthCheck() {
  return new Response(JSON.stringify({
    status: 'ok',
    service: 'windbg-symbol-proxy',
    timestamp: new Date().toISOString(),
    endpoints: {
      symbol_proxy: 'GET /{pdb_name}/{guid}/{filename}',
      health: 'GET /health'
    }
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}