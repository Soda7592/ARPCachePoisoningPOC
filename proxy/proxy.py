import json
import threading
from mitmproxy import http
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
        server = WebsocketServer(host="127.0.0.1", port=SocketPort)
        server.set_fn_new_client(new_client)
        print(f"{Fore.GREEN}[*] WebSocket server started on port {SocketPort}{Style.RESET_ALL}")
        server.run_forever()
    except Exception as e:
        print(f"{Fore.RED}[*] Error starting WebSocket server: {e}{Style.RESET_ALL}")

class Interceptor:
    def __init__(self):
        self.ProxyPort = 8080
        self.ProxyHost = "127.0.0.1"
        proxyThread = threading.Thread(target=start_server, daemon=True)
        proxyThread.start()
        print(f"{Fore.GREEN}[*] Proxy server started on port {self.ProxyPort}{Style.RESET_ALL}")

    def request(self, flow: http.HTTPFlow):
        pass

    def response(self, flow: http.HTTPFlow):
        if server is None :
            return
        try:
            data = {
                'url': flow.request.url,
                'method': flow.request.method,
                'headers': dict(flow.request.headers),
                'status': flow.response.status_code,
                'body': flow.request.text,
                'protocol': flow.request.scheme
            }
            server.send_message_to_all(json.dumps(data))
        except Exception as e:
            print(f"{Fore.RED}[*] Error sending message to clients: {e}{Style.RESET_ALL}")

addons = [
    Interceptor()
]
