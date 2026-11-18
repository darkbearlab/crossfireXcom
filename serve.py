# 開發用伺服器：關閉快取，改了程式重新整理就會生效。
# 用法：python serve.py  → http://localhost:8123
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'Serving on http://localhost:{PORT}')
    httpd.serve_forever()
