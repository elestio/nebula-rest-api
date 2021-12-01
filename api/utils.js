var childProc = require('child_process');
var fs = require("fs");

function execCommand(command){
    return new Promise(function(resolve, reject) {
        childProc.exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }

            resolve({
                out: stdout.trim(), 
                err: stderr.trim()
            });
        });
    });
}

module.exports.execCommand = async (command) => {
    return await execCommand(command);
}

module.exports.CheckLighthouseInstallation = async () => {

    var expectedPath = './nebula/config/ca.key';

    if (fs.existsSync(expectedPath)) {
        //file exists
        console.log("Global cert found!");

        var result = await this.execCommand(`
        cp ./nebula/config/ca.key ./nebula/ca.key
        cp ./nebula/config/ca.crt ./nebula/ca.crt        
        `);
        //console.log(result)
    }
    else{
        console.log("global cert NOT found!");

        //create global cert for 25 years
        var result = await this.execCommand(`
        cd ./nebula;

        #remove old stuffs in the nebula production folder
        rm -f ca.crt
        rm -f ca.key
        rm -f lh.crt
        rm -f lh.key

        ./nebula-cert ca -duration 219000h0m0s  -name "nebula-rest-api" 

        mkdir -p /etc/nebula/;
        cp ca.crt /etc/nebula/ca.crt;
        cp ca.key /etc/nebula/ca.key;

        ./nebula-cert sign -name "lh" -ip "10.255.255.1/8"
        cp lh.crt /etc/nebula/lh.crt;
        cp lh.key /etc/nebula/lh.key;
        
        `);

        if (result.err == "" || result.err == null){
            console.log("LightHouse Global cert check: OK");
        }
        else{
            console.log("LightHouse Global cert check error: ", result)
        }

    }

    var root = require('path').resolve('./');

    expectedPath = './nebula/config/lh.key';
    if (!fs.existsSync(expectedPath)) {
        var result = await this.execCommand(`
        cd ./nebula;

        ./nebula-cert sign -name "lh" -ip "10.255.255.1/8"

        cp lh.crt ${root}/nebula/config/lh.crt;
        cp lh.key ${root}/nebula/config/lh.key;
        
        `);
    }

    //write lighthouse config file if not present
    //var runInDocker = fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker');
    var isTapDisabled = false;
    

    expectedPath = './nebula/config/lh.yml';
    if (!fs.existsSync(expectedPath)) {

        const caData = fs.readFileSync('./nebula/config/ca.crt', {encoding:'utf8', flag:'r'});
        const cerData = fs.readFileSync('./nebula/config/lh.crt', {encoding:'utf8', flag:'r'});
        const keyData = fs.readFileSync('./nebula/config/lh.key', {encoding:'utf8', flag:'r'});
        
        fs.writeFileSync("./nebula/config/lh.yml", `
pki:
    ca: ${root}/nebula/config/ca.crt
    cert: ${root}/nebula/config/lh.crt
    key: ${root}/nebula/config/lh.key

static_host_map:
    "10.255.255.1": ["${process.env.HOST_DOMAIN}:4242"]

lighthouse:
    am_lighthouse: true
    interval: 60

listen:
    host: 0.0.0.0
    port: 4242

punchy:
    punch: true

cipher: aes


tun:
    disabled: ${isTapDisabled}
    dev: nebula1
    drop_local_broadcast: false
    drop_multicast: false
    tx_queue: 500
    mtu: 1300


logging:
    level: info
    format: text


# Nebula security group configuration
firewall:
conntrack:
    tcp_timeout: 12m
    udp_timeout: 3m
    default_timeout: 10m
    max_connections: 100000

outbound:
    # Allow all outbound traffic from this node
    - port: any
      proto: any
      host: any

inbound:
    # Allow icmp between any nebula hosts
    - port: any
      proto: icmp
      host: any
`);
    }
    

    console.log("Run LH");
    runInBGLoop(); //do not await

    return result;
    
}

//Run Nebula in a background infinite loop 
//to ensure it will restart in case of crash
async function runInBGLoop(){

    //console.log(JSON.stringify(await execCommand(`echo "path: $PWD"`)) );

    var root = require('path').resolve('./');

        //console.log("root: ", root)

        var runInDocker = fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker');
        var isTapDisabled = false;
        //if (runInDocker){
        //    isTapDisabled = true;
        //}



    var cmd = `
        mkdir -p /etc/nebula/
        
        cp ./nebula/ca.crt ./nebula/config/ca.crt
        cp ./nebula/ca.key ./nebula/config/ca.key

        cp ./nebula/config/ca.crt /etc/nebula/ca.crt
        cp ./nebula/config/ca.key /etc/nebula/ca.key
        
        cp ./nebula/lh.crt ./nebula/config/lh.crt
        cp ./nebula/lh.key ./nebula/config/lh.key

        #cp ./nebula/config/lh.crt /etc/nebula/lh.crt;
        #cp ./nebula/config/lh.key /etc/nebula/lh.key;
        #cp ./nebula/config/lh.yml /etc/nebula/lh.yml;

        ./nebula/nebula -config ./nebula/config/lh.yml
    `;

    /*
    while(true){

        await execCommand(cmd);
    }
    */

    var exec = require('child_process').exec;
    var child = exec(cmd);
    child.stdout.on('data', function(data) {
        console.log('stdout: ' + data);
    });
    child.stderr.on('data', function(data) {
        console.log('stderr: ' + data);
    });
    child.on('close', function(code) {
        console.log('closing code: ' + code);
        setTimeout(function(){
            runInBGLoop();
        }, 2000)
        
    });

}