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
