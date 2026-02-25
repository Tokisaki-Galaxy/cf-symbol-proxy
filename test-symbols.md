# Windbg Symbol Proxy - Test Cases

## Common Symbol URLs

### PDB Files
- `ntdll.pdb`: `/ntdll.pdb/1234567890ABCDEF1/ntdll.pdb`
- `kernel32.pdb`: `/kernel32.pdb/1234567890ABCDEF2/kernel32.pdb`
- `user32.pdb`: `/user32.pdb/1234567890ABCDEF3/user32.pdb`

### DLL Files
- `ntdll.dll`: `/ntdll.dll/1234567890ABCDEF4/ntdll.dll`
- `kernel32.dll`: `/kernel32.dll/1234567890ABCDEF5/kernel32.dll`

## Test Commands

### Health Check
```bash
curl https://symbols.tokisaki.top/health
```

### Test Symbol Download
```bash
# Test with curl
curl -I https://symbols.tokisaki.top/ntdll.pdb/1234567890ABCDEF1/ntdll.pdb

# Download test
curl -o test.pdb https://symbols.tokisaki.top/ntdll.pdb/1234567890ABCDEF1/ntdll.pdb
```

### Windbg Test Commands
```
.sympath+ SRV*C:\Symbols*https://symbols.tokisaki.top
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