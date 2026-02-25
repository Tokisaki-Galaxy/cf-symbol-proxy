# Windbg Symbol Proxy

<div align="center">

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/github/license/Tokisaki-Galaxy/cf-symbol-proxy?style=for-the-badge&color=0078d4)](https://github.com/Tokisaki-Galaxy/cf-symbol-proxy/blob/main/LICENSE)
[![WinDbg Support](https://img.shields.io/badge/Debug-WinDbg-blue?style=for-the-badge&logo=windows&logoColor=white)](https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/debugger-download-tools)

</div>

---

A high-performance Cloudflare Workers proxy for accelerating WinDbg symbol downloads. Unlike other implementations, this project uses the **Cache API** to bypass KV storage limits and specifically fixes the "0-byte HEAD request" pollution issue common with Microsoft's symbol server.

## Features

- **Cache API Integration**: No file size limits (supports large PDBs > 100MB) and zero memory overhead.
- **HEAD Request Fix**: Automatically upgrades `HEAD` checks to `GET` requests to prevent 0-byte cache pollution from Microsoft/Azure CDN.
- **Long-term Caching**: Sets `immutable` cache headers (1-year TTL) for symbols, as they never change once released.
- **Smart 404 Handling**: Caches "Not Found" responses for 1 hour to reduce redundant upstream pressure and speed up WinDbg's fallback logic.
- **GitHub Actions Ready**: Continuous deployment out of the box.

## 🛠 Usage

### 1. WinDbg Configuration

Set your symbol path in WinDbg:
```text
.sympath srv*C:\Symbols*https://symbols.tokisaki.top
.reload
```

### 2. Environment Variable (Recommended)

Add a system environment variable `_NT_SYMBOL_PATH` to make it permanent:
- **Variable Name**: `_NT_SYMBOL_PATH`
- **Variable Value**: `srv*C:\Symbols*https://symbols.tokisaki.top`

> [!IMPORTANT]
> **Custom Domain Required**: Cloudflare's Cache API **only** works on custom domains. It will NOT cache anything if you use the default `*.workers.dev` subdomain.

## Deployment

### Prerequisites
- A Cloudflare account with a **Custom Domain** added.
- GitHub API Token for deployment (see GitHub Actions setup).

### Setup
1. **Fork/Clone**:
   ```bash
   git clone https://github.com/Tokisaki-Galaxy/cf-symbol-proxy.git
   ```
2. **Configure**: Edit `wrangler.toml` to match your domain:
   ```toml
   [triggers]
   routes = [
     { pattern = "symbols.yourdomain.com/*", custom_domain = true }
   ]
   ```
3. **Deploy**:
   - **Local**: `npx wrangler deploy`
   - **CI/CD**: Push to `main` branch (requires `CLOUDFLARE_API_TOKEN` in GitHub Secrets).

## 📝 Configuration

Variables in `wrangler.toml`:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `SYMBOL_SERVER` | Upstream symbol source | `https://msdl.microsoft.com/download/symbols` |

## 🔍 How it Works (The "0-byte" Fix)

Microsoft's Symbol Server often returns a `200 OK` with `Content-Length: 0` for `HEAD` requests, even for non-existent files. Standard proxies often cache this empty response, breaking subsequent downloads.

This proxy:
1. Intercepts all requests and checks the Cloudflare **Cache API**.
2. If a miss occurs, it **always uses `GET`** to fetch from the upstream.
3. It validates the response before storing it.
4. It serves the client's `HEAD` or `GET` request from the now-validated cache.

## 🧪 Testing

### Health Check
```bash
curl -I https://symbols.tokisaki.top/health
```

### Test Symbol Download (NTDLL)
```bash
# First time: MISS (Fetch from Microsoft)
# Second time: HIT (Served from Cloudflare Cache)
curl -svo /dev/null "https://symbols.tokisaki.top/ntdll.pdb/2CF5F86ACB68735923D72913BBD9B0E31/ntdll.pdb" 2>&1 | grep -iE "< HTTP|< cf-cache|< content-length"
```
