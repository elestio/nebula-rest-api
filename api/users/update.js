var utils = require('../utils.js');
const fs = require('fs');
const path = require('path');

module.exports = async (event) => {

    var force = "";
    var version = "";
    var updateThemes = "";
    var updatePlugins = "";
    var domain = event.POST.domain;
    var site = domain;

    var result = "";
    //var cmd = 'docker exec wpmulti-php-apache php /usr/local/bin/wp core update --version=3.7 --force --allow-root --path=./sites/test789.com';
    var cmd = `
    docker exec wpmulti-php-apache php /usr/local/bin/wp core update --allow-root --path='./sites/${site}'
    docker exec wpmulti-php-apache php /usr/local/bin/wp core update-db --allow-root --path='./sites/${site}'
    docker exec wpmulti-php-apache php /usr/local/bin/wp theme update --all --allow-root --path='./sites/${site}'
    docker exec wpmulti-php-apache php /usr/local/bin/wp plugin update --all --allow-root --path='./sites/${site}'
    `;
    try{
        var execResp = await utils.execCommand(cmd);
        
        result = execResp;
    }
    catch(ex){
        result = {error: ex.message, stack: ex.stack }
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