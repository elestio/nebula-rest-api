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

## Sample API call with curl to add a new user

    curl -X POST \
    https://YOUR_HOST_DOMAIN_HERE/api/users/add \
    -H 'content-type: application/x-www-form-urlencoded' \
    -H 'x-api-key: YOUR_API_KEY_HERE' \
    -d 'subnet=10.17.3.0&clientName=myserver1'