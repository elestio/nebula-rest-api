var utils = require('../utils.js');
var fs = require('fs');
const path = require("path");

module.exports = async (event) => {  

    var subnet = event.POST.subnet;
    var isNameValid = /^[0-9\.]{4,32}$/.test(subnet)
    if (!isNameValid){
        return {  
            httpStatus: "400",
            headers:{ "Content-Type": "application/json" },  
            content: {
                status: "KO",
                details: "Invalid subnet provided, only numbers and dots are allowed (eg: 10.17.58.0)"
            }
        };
    }

    var subnetArr = subnet.split('.');
    var compositPath = "./nebula/networks/" + subnetArr[0] + "/" + subnetArr[1] + "/" + subnetArr[2] + "/" + "0";


    var files = getAllFiles(compositPath, []);
    var filtered = [];
    for(var i=0; i<files.length; i++){
        if ( !files[i].endsWith(".0") ){
            var arr = files[i].split('/');
            filtered.push( arr[arr.length-1] );
        }
    }

    var response = {
        status: "OK",
        clients: filtered
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



const getAllFiles = function(dirPath, arrayOfFiles) {
  files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(path.join(__dirname, dirPath, "/", file))
    }
  })

  return arrayOfFiles
}