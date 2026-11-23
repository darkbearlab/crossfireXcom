# 開發用伺服器：關閉快取，改了程式重新整理就會生效。
# 用法：python serve.py  → http://localhost:8123
# 觀戰：遊戲開 ?watch 時，代理的每一步會 POST 到 /watch/push，存在 playtests/watch/<場次>/；
#       watch.html 讀 /watch/feed 同步顯示（同一個區網的手機也能看：http://<電腦的 IP>:<port>/watch.html）。
import base64
import http.server
import json
import os
import re
import socketserver
import sys
from urllib.parse import urlparse, parse_qs

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
ROOT = os.path.dirname(os.path.abspath(__file__))
WATCH = os.path.join(ROOT, 'playtests', 'watch')


def sid_ok(s):
    return bool(re.fullmatch(r'[0-9-]{1,32}', s or ''))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != '/watch/push':
            return self.send_json({'error': 'not found'}, 404)
        sid = parse_qs(u.query).get('sid', [''])[0]
        if not sid_ok(sid):
            return self.send_json({'error': 'bad sid'}, 400)
        n = int(self.headers.get('Content-Length') or 0)
        if n > 8_000_000:
            return self.send_json({'error': 'too big'}, 413)
        ev = json.loads(self.rfile.read(n) or b'{}')
        d = os.path.join(WATCH, sid)
        os.makedirs(d, exist_ok=True)
        shot = ev.pop('shot', None)
        if isinstance(shot, str) and shot.startswith('data:image/jpeg;base64,'):
            name = f"{int(ev.get('i', 0)):04d}.jpg"
            with open(os.path.join(d, name), 'wb') as f:
                f.write(base64.b64decode(shot.split(',', 1)[1]))
            ev['shot'] = f'/playtests/watch/{sid}/{name}'
        with open(os.path.join(d, 'events.jsonl'), 'a', encoding='utf-8') as f:
            f.write(json.dumps(ev, ensure_ascii=False) + '\n')
        self.send_json({'ok': True})

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/watch/sessions':
            ids = sorted([s for s in os.listdir(WATCH) if sid_ok(s)], reverse=True) if os.path.isdir(WATCH) else []
            return self.send_json(ids)
        if u.path == '/watch/feed':
            q = parse_qs(u.query)
            sid = q.get('sid', [''])[0]
            since = int(q.get('since', ['0'])[0] or 0)
            p = os.path.join(WATCH, sid, 'events.jsonl')
            if not sid_ok(sid) or not os.path.exists(p):
                return self.send_json([])
            with open(p, encoding='utf-8') as f:
                evs = [json.loads(l) for l in f if l.strip()]
            return self.send_json([e for e in evs if e.get('i', 0) >= since])
        return super().do_GET()


class Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


with Server(('', PORT), NoCacheHandler) as httpd:
    print(f'Serving on http://localhost:{PORT}')
    httpd.serve_forever()
