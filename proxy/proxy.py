import json
import threading
from mitmproxy import http, tls, proxy
from mitmproxy.proxy.layers import http as http_layers
from http.server import HTTPServer
from websocket_server import WebsocketServer
from colorama import Fore, Style, init

init(autoreset=True)
SocketPort = 8088
server = None

def new_client(client, server):
    print(f"{Fore.GREEN}[*] New client connected{Style.RESET_ALL}")

def start_server():
    global server
    try:
        server = WebsocketServer(host="0.0.0.0", port=SocketPort)
        server.set_fn_new_client(new_client)
        print(f"{Fore.GREEN}[*] WebSocket server started on port {SocketPort}{Style.RESET_ALL}")
        server.run_forever()
    except Exception as e:
        print(f"{Fore.RED}[*] Error starting WebSocket server: {e}{Style.RESET_ALL}")

class Interceptor:
    def __init__(self):
        self.ProxyPort = 8080
        self.ProxyHost = "0.0.0.0"
        proxyThread = threading.Thread(target=start_server, daemon=True)
        proxyThread.start()
        print(f"{Fore.GREEN}[*] Proxy server started on port {self.ProxyPort}{Style.RESET_ALL}")

    def tls_clienthello(self, flow: tls.ClientHelloData):
        sni = flow.client_hello.sni
        if sni:
            print(f"[{flow.context.client.peername}] Detected SNI: {sni}, setting ignore_connection")
            flow.ignore_connection = True
            flow.context.server.address = (sni, 443)
        else:
            print(f"[{flow.context.client.peername}] No SNI available, cannot set hostname")

    def request(self, flow: http.HTTPFlow):
        print(f"Request from {flow.client_conn.peername}: {flow.request.url}, scheme: {flow.request.scheme}, method: {flow.request.method}")

    def response(self, flow: http.HTTPFlow):
        if server is None:
            return
        print(f"Response for {flow.request.url}, scheme: {flow.request.scheme}")
        try:
            unwanted_keywords = [
                "gstatic.com", "doubleclick.net", "consumer.cloud.gist.build",
                "googleapis.com", "api2.cursor.sh", "play.google.com",
                "main.vscode-cdn.net", "googlevideo.com", "google.com",
                "gvt1.com", "gvt2.com", "ggpht.com"
            ]
            unwanted_extensions = [
                ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".ico",
                ".svg", ".webp", ".woff", ".woff2", ".ttf", ".eot"
            ]
            url = flow.request.pretty_url
            if any(url.endswith(ext) for ext in unwanted_extensions):
                return
            if any(keyword in url for keyword in unwanted_keywords):
                return

            try:
                req_body = flow.request.get_text(strict=False)
            except Exception:
                req_body = None

            if not req_body:
                raw = flow.request.raw_content
                if raw is not None:
                    snippet = raw[:512]
                    try:
                        req_body = snippet.decode("utf-8", errors="replace")
                    except Exception:
                        req_body = f"<binary {len(raw)} bytes>"
                else:
                    req_body = ""

            data = {
                'client_ip': flow.client_conn.peername[0],
                'url': flow.request.url,
                'method': flow.request.method,
                'headers': dict(flow.request.headers),
                'status': flow.response.status_code,
                'body': req_body,
                'protocol': flow.request.scheme
            }
            server.send_message_to_all(json.dumps(data))
        except Exception as e:
            print(f"{Fore.RED}[*] Error sending message to clients: {e}{Style.RESET_ALL}")

    def error(self, flow: http.HTTPFlow):
        print(f"Error for {flow.client_conn.peername}: {flow.error}")

addons = [
    Interceptor()
]