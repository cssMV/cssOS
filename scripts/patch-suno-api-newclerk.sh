#!/bin/bash
# CSSOS_PHASE2_SUNO_API_NEW_CLERK 20260430 — patch gcui-art/suno-api
# to work with Suno's new Clerk multi-instance auth (no bare __client cookie).
# Bypasses Clerk's /v1/client session lookup and uses the __session JWT
# directly: decodes JWT to extract sid, uses JWT as Bearer token.
set -e
cd /srv/cssos/suno-api/src/lib
[ -f SunoApi.ts.orig ] || cp SunoApi.ts SunoApi.ts.orig
# Restore original first so patches stack cleanly
cp SunoApi.ts.orig SunoApi.ts

python3 - <<'PYEOF'
import re
p = 'SunoApi.ts'
s = open(p).read()

# Replace getAuthToken() body to skip Clerk and decode __session JWT directly.
old = re.search(r'private async getAuthToken\(\)[^\{]*\{(.+?)^  \}', s, flags=re.DOTALL | re.MULTILINE)
assert old, 'getAuthToken not found'
new_body = '''
    logger.info('Bootstrapping auth from __session JWT (new-Clerk bypass)');
    const sessionJwt = this.cookies.__session;
    if (!sessionJwt) {
      throw new Error('Failed to get session id, you may need to update the SUNO_COOKIE (no __session cookie)');
    }
    try {
      const parts = sessionJwt.split('.');
      if (parts.length !== 3) throw new Error('not a JWT');
      const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - payloadB64.length % 4) % 4);
      const payload = JSON.parse(Buffer.from(payloadB64 + padding, 'base64').toString('utf8'));
      if (!payload.sid) throw new Error('JWT missing sid claim');
      this.sid = payload.sid;
      this.currentToken = sessionJwt;
      logger.info('sid=' + this.sid);
    } catch (e) {
      throw new Error('Failed to decode __session JWT: ' + (e as Error).message);
    }
  '''
new_method = 'private async getAuthToken() {' + new_body
s = s.replace(old.group(0), new_method)

# Also relax the "cookie includes __client" check at line 853 to accept __session
s = s.replace("cookie.includes('__client')", "cookie.includes('__session')")
s = s.replace('cookie.includes("__client")', 'cookie.includes("__session")')

open(p, 'w').write(s)
print('patched ok')
PYEOF

echo "--- diff vs orig (first 50 lines) ---"
diff SunoApi.ts.orig SunoApi.ts | head -50
echo "--- rebuild suno-api ---"
cd /srv/cssos/suno-api
npm run build > /tmp/suno-api-rebuild.log 2>&1
tail -5 /tmp/suno-api-rebuild.log
echo "--- restart ---"
sudo systemctl restart suno-api
sleep 5
sudo systemctl is-active suno-api
echo "--- healthcheck ---"
curl -sS http://127.0.0.1:3001/api/get_limit --max-time 30 2>&1 | head -c 600
echo
echo "--- recent log ---"
sudo journalctl -u suno-api -n 12 --no-pager | tail -12
