var utils = require('../utils.js');
var fs = require('fs');

module.exports = async (event) => {

    var networkName = event.POST.networkName;
    var isNameValid = /^[0-9a-zA-Z\.\-]{4,255}$/.test(networkName)

    if (!isNameValid){
        return {  
            httpStatus: "400",
            headers:{ "Content-Type": "application/json" },  
            content: {
                status: "KO",
                details: "Invalid networkName provided, only letters, numbers, dot and dash are allowed"
            }
        };
    }
    

    //find last network created
    var lastNetwork = "10.17.0.0";
    var lastNetworkFile = "./nebula/networks/last.txt";
    if (fs.existsSync(lastNetworkFile)) {
        lastNetwork = fs.readFileSync(lastNetworkFile, {encoding:'utf8', flag:'r'});
    }

    var lastNetworkArr = lastNetwork.split('.');
    var newNetworkArr = lastNetworkArr; lastNetworkArr[3] = 255;
    var newNetwork = incrementIP(newNetworkArr);
    var newNetworkStr = newNetwork[0] + "." + newNetwork[1] + "." + newNetwork[2] + "." + newNetwork[3];

    //console.log("New Network: " + newNetworkStr);

    //create folder structure for the new network (this replace a db ...)
    var compositPath = "./nebula/networks/" + newNetwork[0] + "/" + newNetwork[1] + "/" + newNetwork[2] + "/" + newNetwork[3];
    fs.mkdirSync(compositPath, { recursive: true });
    fs.writeFileSync(compositPath + "/" + newNetworkStr, networkName);

    //update latest network assigned
    fs.writeFileSync(lastNetworkFile, newNetworkStr);
    
    var response = {
        status: "OK",
        details: "New network created",
        network: newNetworkStr
    }
    
    return {  
        httpStatus: "200",
        headers:{ "Content-Type": "application/json" },  
        content: response  
    };

};


function incrementIP(inputIP) {
    let ip = (inputIP[0] << 24) | (inputIP[1] << 16) | (inputIP[2] << 8) | (inputIP[3] << 0);
    ip++;
    return [ip >> 24 & 0xff, ip >> 16 & 0xff, ip >> 8 & 0xff, ip >> 0 & 0xff];
}