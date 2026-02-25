# Windbg Symbol Proxy - Test Cases

## Common Symbol URLs

`https://msdl.microsoft.com/download/symbols/ntdll.pdb/2CF5F86ACB68735923D72913BBD9B0E31/ntdll.pdb`

## Test Commands

### Health Check
```bash
curl https://symbols.tokisaki.top/health
```

### Test Symbol Download
```bash
# Test with curl
curl -svo /dev/null "https://symbols.tokisaki.top/ntdll.pdb/2CF5F86ACB68735923D72913BBD9B0E31/ntdll.pdb" 2>&1 | grep -iE "< HTTP|< cf-cache|< content-length|< x-proxy-debug"

# Download test
curl -o test.pdb https://symbols.tokisaki.top/ntdll.pdb/2CF5F86ACB68735923D72913BBD9B0E31/ntdll.pdb
```

### Windbg Test Commands
```
.sympath+ SRV*D:\Symbols*https://symbols.tokisaki.top
.reload
!sym noisy
```

## Expected Headers

Cache hits should include:
```
X-Cache: HIT
Cache-Control: public, max-age=86400
```

Cache misses should include:
```
X-Cache: MISS
Cache-Control: public, max-age=86400
```
