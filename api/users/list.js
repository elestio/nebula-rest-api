var utils = require('../utils.js');
const fs = require('fs');
const path = require('path');

module.exports = async (event) => {

    var result = "";

    try{
        var rows = [];
        var array = fs.readdirSync('./nebula/certs/')
        //console.log(array)
        for(var i = 0; i < array.length; i++){
            var cur = array[i];
            if ( cur != "backups" && cur != "preview" ){
                var fullPath = "./sites/" + cur;
                rows.push({
                    domain: cur,
                    path: fullPath
                });
            }
        }
        result = rows;
    }
    catch(ex){
        result = {error: ex.message, stack: ex.stack }

        return {  
            httpStatus: "404",
            headers:{ "Content-Type": "application/json" },  
            content: result  
        };
    }
    

    var response = {
        status: "OK",
        details: result
    }
    
    return {  
        httpStatus: "200",
        headers:{ "Content-Type": "application/json" },  
        content: response  
    };

};


async function listDirectories(rootPath) {
    const fileNames = await fs.promises.readdir(rootPath);
    const filePaths = fileNames.map(fileName => path.join(rootPath, fileName));
    const filePathsAndIsDirectoryFlagsPromises = filePaths.map(async filePath => ({path: filePath, isDirectory: (await fs.promises.stat(filePath)).isDirectory()}))
    const filePathsAndIsDirectoryFlags = await Promise.all(filePathsAndIsDirectoryFlagsPromises);
    
    return filePathsAndIsDirectoryFlags.filter(filePathAndIsDirectoryFlag => filePathAndIsDirectoryFlag.isDirectory)
        .map(filePathAndIsDirectoryFlag => filePathAndIsDirectoryFlag.path);
}