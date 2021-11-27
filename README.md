# nebula-rest-api
REST API for Nebula, handle client management

This is useful if you want to manipulate Nebula with a REST API to:
- Create / Delete networks
- Create / Delete Users & Certificates
- Generate full client config (ca.crt, client.crt, client.key, client.yml)
- Run Nebula lighthouse server


&nbsp;

# Very Quickstart with docker


    docker run -d --name nebula-rest-api -p 80:9000 -p 4242:4242/udp -e HOST_DOMAIN=www.yourdomain.com -e NEBULA_REST_API_KEY=VERY_LONG_RANDOM_STRING elestio/nebula-rest-api


Read more below for a more complete setup with HTTPS


# Quickstart

## Install Git + Docker.io + docker-compose

    sudo apt update -y && apt -y install git docker.io docker-compose

## Clone this repo

    git clone https://github.com/elestio/nebula-rest-api.git
    cd nebula-rest-api;

## Customize .env

Copy the sample.env file:

    cp sample.env .env

Then change the values for all env vars:

    #You should indicate the cname of your vps (eg: ec2-xx-xx-xx-xx.eu-west-1.compute.amazonaws.com)
    #or a subdomain of your main domain, eg: wpmulti.yourdomain.com
    HOST_DOMAIN=yourbasedomain.com

    #API Key is also used to access the WEB UI and call the REST API
    NEBULA_REST_API_KEY=random_very_long_string

    #This lighouse instance
    LIGHTHOUSE_IP=10.255.255.1
    #Optional: if you have multiple Lightouse nodes (format: LH_nebula_ip,real ip or cname:port)
    #OTHER_LIGHTHOUSES=10.255.255.2,lh2.elest.io:4242;10.255.255.3,lh3.elest.io:4242


    #Optional: indicate the path to your certificate and key files in PEM format
    SSL_CERT=/path/to/your/fullchain.pem
    SSL_KEY=/path/to/your/privkey.pem
    #email to receive letsencrypt notifications 
    LETSENCRYPT_EMAIL=test@yopmail.com
&nbsp;

## Run with docker (published official images)

Run just once

    docker-compose up

Run as a docker service

    docker-compose up -d

## Run with docker (build custom images)

Make your changes in the source code then run this:

    ./docker-build.sh
    ./docker-run.sh

If you want to ensure a full rebuild add `--no-cache` after the build command like this:
    
    ./build-front-end.sh
    docker-compose -f docker-compose-build.yml build --no-cache
    ./docker-run.sh


## Run in DEV mode without docker 

Install node.js
	curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
	sudo apt install -y nodejs
Run:
	node index.js

## Run as a service with pm2

    npm install -g pm2
    pm2 start "node index.js" --name nebula-rest-api
    pm2 save
    pm2 startup



&nbsp;
# API Usage

You will need to authenticate all API calls by passing a header `x-api-token: ${NEBULA_REST_API_KEY}` where ${NEBULA_REST_API_KEY} is the value you have configured in .env

## List of endpoints, methods & expected parameters

<details>
  <summary>Click to expand!</summary>

```json
{
    "/api/networks/list": {
        "path": "/api/networks/list.js",
        "method": "POST",
        "parametersList": [],
        "isPrivate": true
    },
    "/api/networks/add": {
        "path": "/api/networks/add.js",
        "method": "POST",
        "parametersList": [
            "networkName"
        ],
        "isPrivate": true
    },
    "/api/networks/delete": {
        "path": "/api/networks/delete.js",
        "method": "POST",
        "parametersList": [
            "subnet"
        ],
        "isPrivate": true
    },
    "/api/users/list": {
        "path": "/api/users/list.js",
        "method": "POST",
        "parametersList": ["subnet"],
        "isPrivate": true
    },
    "/api/users/getConfig": {
        "path": "/api/users/getConfig.js",
        "method": "POST",
        "parametersList": [
            "ip"
        ],
        "isPrivate": true
    },
    "/api/users/add": {
        "path": "/api/users/add.js",
        "method": "POST",
        "parametersList": [
            "subnet",
            "clientName"
        ],
        "isPrivate": true
    },
    "/api/users/delete": {
        "path": "/api/users/delete.js",
        "method": "POST",
        "parametersList": [
            "ip"
        ],
        "isPrivate": true
    }
}
```
</details>

## Sample API call with curl to add a new network

    curl -X POST \
    https://YOUR_HOST_DOMAIN_HERE/api/networks/add \
    -H 'content-type: application/x-www-form-urlencoded' \
    -H 'x-api-key: YOUR_API_KEY_HERE' \
    -d 'networkName=myfirstnetwork1'

Response:

    {
        "status": "OK",
        "details": "New network created",
        "network": "10.17.3.0"
    }

## Sample API call with curl to add a new user

    curl -X POST \
    https://YOUR_HOST_DOMAIN_HERE/api/users/add \
    -H 'content-type: application/x-www-form-urlencoded' \
    -H 'x-api-key: YOUR_API_KEY_HERE' \
    -d 'subnet=10.17.3.0&clientName=myserver1'

Response:

    {
        "status": "OK",
        "CIDR": "10.17.3.1/8",
        "ca": "-----BEGIN NEBULA CERTIFICATE-----\nCkEKD25lYnVsYS1yZXN0LWFwaSjk8smMBjDk2c6bBjogfkZnSCnhlLXvw6jdO/6h\nyZwzOXo58uz8yo0NaIViAWJAARJAv1dt2/jw1ZCeGPgz6DNkgRd6uPo/71H5vXWp\n9nqdG2qN3vdxTuueBuV7kN3DVlg2ZlDHvwNj4j86TImA9aqtCg==\n-----END NEBULA CERTIFICATE-----\n",
        "crt": "-----BEGIN NEBULA CERTIFICATE-----\nCmQKB3Rlc3QxMjMSCYGGxFCAgID4DyjoxsuMBjDj2c6bBjogjgq1/zb/MiRuGcW4\nRY0cEirmvSa5AWeMXuypT5Eh+1RKIPnmGtLYGpSdwXcvMIDkzYlcJkOwBR3WKRpP\nyiNt5tEkEkClf0yGn5XEKAr1O/Ixq2eXr1SNKLGIqXb+7byzCca4/5PfXj8zJPu3\njXg4z86NcsjaTbPWhFJi4OfCihxVnwYP\n-----END NEBULA CERTIFICATE-----\n",
        "key": "-----BEGIN NEBULA X25519 PRIVATE KEY-----\nVkyOFWYMiSceKHrXTuhtITB7wzPeJoH0oQDA+FYv9i8=\n-----END NEBULA X25519 PRIVATE KEY-----\n",
        "clientName": "test123",
        "clientYML": "\npki:\n  # The CAs that are accepted by this node. Must contain one or more certificates created by 'nebula-cert ca'\n  ca: /tmp/ca.crt\n  cert: /tmp/jo2.crt\n  key: /tmp/jo2.key\n\nstatic_host_map:\n  \"10.255.255.1\": [\"vms2.terasp.net:4242\"]\n\n\nlighthouse:\n  am_lighthouse: false\n  interval: 60\n  # hosts is a list of lighthouse hosts this node should report to and query from\n  # IMPORTANT: THIS SHOULD BE EMPTY ON LIGHTHOUSE NODES\n  # IMPORTANT2: THIS SHOULD BE LIGHTHOUSES' NEBULA IPs, NOT LIGHTHOUSES' REAL ROUTABLE IPs\n  hosts:\n    - \"10.255.255.1\"\n\nlisten:\n  # To listen on both any ipv4 and ipv6 use \"[::]\"\n  host: 0.0.0.0\n  port: 4242\n\npunchy:\n  # Continues to punch inbound/outbound at a regular interval to avoid expiration of firewall nat mappings\n  punch: true\n\ntun:\n  disabled: false\n  dev: nebula1\n  drop_local_broadcast: false\n  drop_multicast: false\n  tx_queue: 500\n  mtu: 1300\n\nlogging:\n  level: info\n  format: text\n\n  \nfirewall:\n  conntrack:\n    tcp_timeout: 12m\n    udp_timeout: 3m\n    default_timeout: 10m\n    max_connections: 100000\n\n  outbound:\n    # Allow all outbound traffic from this node\n    - port: any\n      proto: any\n      host: any\n\n  inbound:\n    # Allow icmp between any nebula hosts\n    - port: any\n      proto: icmp\n      host: any\n\n    # Allow tcp/443 from any host with BOTH laptop and home group\n    - port: any\n      proto: any\n      cidr: 10.17.3.0/24\n"
    }


&nbsp;
## client installation

You can download an installation script for various OS for the new ip you have just created above with `/api/users/add`.

Linux:
    
    https://YOUR_HOST_DOMAIN_HERE/api/users/getConfig?apiKey=YOUR_API_KEY_HERE&mode=linux&ip=10.17.3.1

Windows:
    
    https://YOUR_HOST_DOMAIN_HERE/api/users/getConfig?apiKey=YOUR_API_KEY_HERE&mode=windows&ip=10.17.3.1

MacOSX: 
    
    Not yet done

JSON (Generic):

    https://YOUR_HOST_DOMAIN_HERE/api/users/getConfig?apiKey=YOUR_API_KEY_HERE&mode=json&ip=10.17.3.1

&nbsp;
## How to uninstall

Linux: 

    service nebula stop
    systemctl disable nebula;
    rm /etc/systemd/system/nebula.service;
    rm -rf /opt/nebula/;
    systemctl daemon-reload;

Windows:

    Set-Variable -Name pathNebula -Value $env:UserProfile\Documents\Nebula
    Stop-Service -Name "Nebula Network Service"
    Invoke-Expression "& `"$pathNebula\nebula.exe`" -service uninstall"

