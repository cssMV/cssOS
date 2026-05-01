#!/bin/bash
# Minimal patch for new-Clerk Suno session: replace getAuthToken body cleanly.
set -e
cd /srv/cssos/suno-api/src/lib
cp SunoApi.ts.orig SunoApi.ts
echo "--- restored from .orig ---"

# Use python to do precise replacement with a properly closed function body.
python3 - <<'PYEOF'
src_path = 'SunoApi.ts'
s = open(src_path).read()

# The original method signature + body to find:
needle = """  private async getAuthToken() {
    logger.info('Getting the session ID');
    // URL to get session ID
    const getSessionUrl = `${SunoApi.CLERK_BASE_URL}/v1/client?__clerk_api_version=2025-11-10&_clerk_js_version=${SunoApi.CLERK_VERSION}`;
    // Get session ID
    const sessionResponse = await this.client.get(getSessionUrl, {
      headers: { Authorization: this.cookies.__client }
    });
    if (!sessionResponse?.data?.response?.last_active_session_id) {
      throw new Error(
        'Failed to get session id, you may need to update the SUNO_COOKIE'
      );
    }
    // Save session ID for later use
    this.sid = sessionResponse.data.response.last_active_session_id;
  }"""

replacement = """  private async getAuthToken() {
    // CSSOS_PHASE2_NEW_CLERK_BYPASS — Suno new Clerk has no bare __client
    // cookie, only __session JWT. Decode JWT to extract sid + use as Bearer.
    logger.info('Bootstrapping auth from __session JWT (new-Clerk bypass)');
    const sessionJwt = this.cookies.__session;
    if (!sessionJwt) {
      throw new Error('SUNO_COOKIE missing __session cookie');
    }
    const parts = sessionJwt.split('.');
    if (parts.length !== 3) {
      throw new Error('__session is not a valid JWT');
    }
    let payload: any;
    try {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - b64.length % 4) % 4);
      payload = JSON.parse(Buffer.from(b64 + padding, 'base64').toString('utf8'));
    } catch (e) {
      throw new Error('Failed to decode __session JWT: ' + (e as Error).message);
    }
    if (!payload.sid) {
      throw new Error('__session JWT missing sid claim');
    }
    this.sid = payload.sid;
    this.currentToken = sessionJwt;
    logger.info('sid=' + this.sid);
  }"""

if needle not in s:
    raise SystemExit('FATAL: getAuthToken signature in .orig did not match expected text')

s = s.replace(needle, replacement)
# Also relax the cookie-presence check from __client to __session
s = s.replace("cookie.includes('__client')", "cookie.includes('__session')")
open(src_path, 'w').write(s)
print('patched cleanly')
PYEOF

echo "--- diff (lines around getAuthToken + cookie check) ---"
diff SunoApi.ts.orig SunoApi.ts | head -50

echo "--- rebuild ---"
cd /srv/cssos/suno-api
rm -rf .next
npm run build > /tmp/suno-rebuild3.log 2>&1
RC=$?
echo "build exit=$RC"
tail -5 /tmp/suno-rebuild3.log
[ $RC -ne 0 ] && exit $RC

echo "--- restart suno-api ---"
sudo systemctl restart suno-api
sleep 5
sudo systemctl is-active suno-api

echo "--- healthcheck ---"
curl -sS http://127.0.0.1:3001/api/get_limit --max-time 30 2>&1 | head -c 600
echo
echo "--- recent log (with sid) ---"
sudo journalctl -u suno-api --since "30 seconds ago" --no-pager | grep -E "sid=|Bootstrap|Error|ERROR" | tail -10
