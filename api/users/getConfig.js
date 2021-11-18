var utils = require('../utils.js');
var fs = require('fs');

module.exports = async (event) => {

    var mode = event.GET.mode; //can be "json", "linux", "windows", "osx"

    var ip = event.GET.ip;
    var isNameValid = /^[0-9\.]{4,32}$/.test(ip)
    if (!isNameValid){
        return {  
            httpStatus: "400",
            headers:{ "Content-Type": "application/json" },  
            content: {
                status: "KO",
                details: "Invalid ip provided, numbers and dots are allowed (eg: 10.17.58.0)"
            }
        };
    }


    var subnetArr = ip.split('.');
    var compositPath = "./nebula/config/networks/" + subnetArr[0] + "/" + subnetArr[1] + "/" + subnetArr[2] + "/" + "0";
    if (!fs.existsSync(compositPath)) {
        //directory doesnt exists
        return {  
            httpStatus: "400",
            headers:{ "Content-Type": "application/json" },  
            content: {
                status: "KO",
                details: "Network doesn't exist!"
            }
        };
    }


    if (!fs.existsSync(compositPath + "/" + ip)) {
        //ip doesnt exists
        return {  
            httpStatus: "400",
            headers:{ "Content-Type": "application/json" },  
            content: {
                status: "KO",
                details: "IP provided doesn't exist!"
            }
        };
    }

    var config = fs.readFileSync(compositPath + "/" + ip, {encoding:'utf8', flag:'r'});
    var json = JSON.parse(config);

    if ( mode == null || mode == "" || mode == "json"){
        return {  
            httpStatus: "200",
            headers:{ "Content-Type": "application/json" },  
            content: json
        };
    }
    else if (mode == "linux"){
        
        var nebula_ca = json.ca; 
        var nebula_crt = json.crt; 
        var nebula_key = json.key; 
        var nebula_yml = json.clientYML;

var shell = `
mkdir -p  /etc/nebula/;

#create nebula conf files
cat > /etc/nebula/ca.crt << EOF
${nebula_ca}
EOF

cat > /etc/nebula/client.crt << EOF
${nebula_crt}
EOF

cat > /etc/nebula/client.key << EOF
${nebula_key}
EOF

cat > /etc/nebula/client.yml << EOF
${nebula_yml}
EOF

cat > /etc/systemd/system/nebula.service << EOF
[Unit]
Description=nebula
Documentation=https://github.com/elestio/nebula-rest-api
After=network.target network-online.target
Requires=network-online.target
[Service]
User=root
User=root
ExecStart=/etc/nebula/nebula -config /etc/nebula/client.yml
ExecReload=/etc/nebula/nebula -config /etc/nebula/client.yml
TimeoutStopSec=5s
LimitNOFILE=1048576
LimitNPROC=512
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE
[Install]
WantedBy=multi-user.target
EOF

#download and install nebula binary
wget https://github.com/elestio/nebula-rest-api/raw/main/nebula/nebula -O /etc/nebula/nebula
chmod +x /etc/nebula/nebula;

systemctl daemon-reload
service nebula restart
systemctl enable nebula
`;

        return {  
            httpStatus: "200",
            headers:{ "Content-Type": "text/x-shellscript", "Content-Disposition": 'attachment; filename="nebula_' + ip + '.sh"' },  
            content: shell
        };
    }
    else if (mode == "windows"){
        
        var nebula_ca = json.ca; 
        var nebula_crt = json.crt; 
        var nebula_key = json.key; 
        var nebula_yml = json.clientYML;

var powershell = `

Set-Variable -Name pathNebula -Value $env:UserProfile\\Documents\\Nebula

#create folder if not exist
If (!(test-path $pathNebula))
{
    md $pathNebula
}

#create nebula conf files
New-Item -Force $pathNebula\\ca.crt
Add-Content -Path "$pathNebula\\ca.crt" -Value @"
${nebula_ca}
"@

New-Item -Force $pathNebula\\client.crt
Add-Content -Path "$pathNebula\\client.crt" -Value @"
${nebula_crt}
"@

New-Item -Force $pathNebula\\client.key
Add-Content -Path "$pathNebula\\client.key" -Value @"
${nebula_key}
"@

New-Item -Force $pathNebula\\client.yml
Add-Content -Path "$pathNebula\\client.yml" -Value @"
${nebula_yml}
"@

New-Item -Force $pathNebula\\client.yml
Add-Content -Path "$pathNebula\\client.yml" -Value @"
${nebula_yml}
"@.Replace("/etc/nebula/", "$pathNebula\\")

New-Item -Force $pathNebula\\uninstall.ps1
Add-Content -Path "$pathNebula\\uninstall.ps1" -Value @"
Set-Variable -Name pathNebula -Value $env:UserProfile\Documents\Nebula
Stop-Service -Name "Nebula Network Service"
Invoke-Expression "& \`"$pathNebula\\nebula.exe\`" -service uninstall -config $pathNebula\\client.yml"
"@

#download into temp file
Write-Output "downloading zip"
#Invoke-WebRequest -Uri "https://github.com/slackhq/nebula/releases/download/v1.5.0/nebula-windows-amd64.zip" -OutFile $pathNebula\\nebula.zip
$WebClient = New-Object System.Net.WebClient
$WebClient.DownloadFile("https://github.com/elestio/nebula-rest-api/raw/main/nebula/nebula.exe","$pathNebula\\nebula.exe")

#install as a service
Invoke-Expression "& \`"$pathNebula\\nebula.exe\`" -service install -config $pathNebula\\client.yml"
Start-Service -Name "Nebula Network Service"

`;

        return {  
            httpStatus: "200",
            headers:{ "Content-Type": "application/octet-stream", "Content-Disposition": 'attachment; filename="nebula_' + ip + '.ps1"' },  
            content: powershell
        };
    }


};