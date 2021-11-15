var utils = require('../utils.js');
var fs = require('fs');

module.exports = async (event) => {

    var subnet = event.POST.subnet;
    var isNameValid = /^[0-9\.]{4,32}$/.test(subnet)

    if (!isNameValid){
        return {  
            httpStatus: "400",
            headers:{ "Content-Type": "application/json" },  
            content: {
                status: "KO",
                details: "Invalid subnet provided, numbers and dots are allowed (eg: 10.17.58.0)"
            }
        };
    }


    var subnetArr = subnet.split('.');
    var compositPath = "./nebula/networks/" + subnetArr[0] + "/" + subnetArr[1] + "/" + subnetArr[2] + "/" + subnetArr[3];
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

    //remove that network folder
    var compositRange = "./nebula/networks/" + subnetArr[0] + "/" + subnetArr[1] + "/" + subnetArr[2] + "/";
    fs.rm(compositRange, { recursive: true }, function(){});

    return {  
        httpStatus: "200",
        headers:{ "Content-Type": "application/json" },  
        content: {
            status: "OK",
            details: "Network deleted",
            network: subnet
        }  
    };

};