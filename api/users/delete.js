var utils = require('../utils.js');
var fs = require('fs');

module.exports = async (event) => {

    var ip = event.POST.ip;
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

    //remove that ip
    fs.rm(compositPath + "/" + ip, { recursive: false }, function(){});

    return {  
        httpStatus: "200",
        headers:{ "Content-Type": "application/json" },  
        content: {
            status: "OK",
            details: "ip deleted",
            ip: ip
        }  
    };

};