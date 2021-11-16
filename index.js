require('dotenv').config();
const path = require("path");
const coregate = require('@elestio/cloudgate/coregate.js');
const staticFiles = require('@elestio/cloudgate/modules/static-files.js');
const { getIP } = require('@elestio/cloudgate/modules/tools.js');
const memory = require('@elestio/cloudgate/modules/memory');
const sharedMemory = require('@elestio/cloudgate/modules/shared-memory');

const api = require('./api.js');
const apiconfig = require('./apiconfig.json')

const utils = require("./api/utils");

const port = process.env.PORT || 9000;
const sslActivated = process.env.SSL || "0";
const SSL_PORT = process.env.SSL_PORT || 443;
const SSL_CERT = process.env.SSL_CERT;
const SSL_KEY = process.env.SSL_KEY;


//low precision current timestamp, this is much faster than creating a new timestamp on each request
var globalTimestamp = -1;
setInterval( function() { globalTimestamp = (+new Date()); }, 100 );

//handle multithreading
const { Worker, isMainThread, threadId } = require('worker_threads');
const os = require('os');
const nbThreads = os.cpus().length;

if (isMainThread) {

    console.log(new Date());
    console.log("Starting nebula-rest-api ...");

    utils.CheckLighthouseInstallation();

    let workersList = [];
    function handleMessage(msg) {
        for (let i = 0; i < workersList.length; i++) {
            if (msg.type == "CG_WS_MSG") {
                workersList[i].postMessage(msg);
            }
        }
    }

    /* Main thread loops over all CPUs */
    os.cpus().forEach(() => {
        /* Spawn a new thread running this source file */
        let worker = new Worker(__filename);
        worker.on('message', handleMessage);
        workersList.push(worker);
    });

} else {
    /* Here we are inside a worker thread */

    var app = null;

    if (sslActivated != "1") {
        app = coregate.App();
    }
    else {
        app = coregate.SSLApp({
            key_file_name: SSL_KEY,
            cert_file_name: SSL_CERT
        });
    }


    //handling caching expirations/purge
    var cacheDuration_static = apiconfig.global.cacheDurationForStatic;
    var cacheDuration_api = apiconfig.global.cacheDurationForAPI;
    setInterval(function(){
        cleanCache();
    }, 1000);

    function cleanCache(){
        var keys = Object.keys(staticCache);
        for(var i = 0; i < keys.length; i++){
            var k = keys[i];

            // if (staticCache[cacheKey] != null && globalTimestamp < staticCache[cacheKey].timestamp + cacheDuration ) {
            if (globalTimestamp > staticCache[k].timestamp + cacheDuration_static){
                //console.log("Cache eviction for key: " + k + " in Thread: " + threadId);
                delete staticCache[k];
            }
        }
    }


    //default route for static files
    var staticCache = {};
    app.get('/*', async (res, req) => {
        const beginPipeline = process.hrtime();

        res.onAborted(() => {
            res.aborted = true;
        });

        var cacheKey = req.getUrl();


        /*
        var cacheItemShared = sharedMemory.getString(cacheKey, "staticCache");
        if ( cacheItemShared != null && cacheItemShared != ""){
            cacheItemShared = JSON.parse(cacheItemShared);
        }
        */
        
        if (staticCache[cacheKey] != null && globalTimestamp < staticCache[cacheKey].timestamp + cacheDuration_static ) {
        //if (cacheItemShared != null && globalTimestamp < cacheItemShared.timestamp + cacheDuration ) {

            //var cacheItem = cacheItemShared;
            var cacheItem = staticCache[cacheKey];
            res.writeStatus(cacheItem.status);

            //write cached headers
            cacheItem.headers["core-cache"] = "1";
            for (var key in cacheItem.headers) {
                res.writeHeader(key, cacheItem.headers[key] + "");
            }

            //since this cache item was used let's update the cache timestamp to avoid too quick eviction
            staticCache[cacheKey].timestamp = globalTimestamp;

            //console.log("served from cache")
            //console.log("cached: ", cacheItem.body)
            //res.end(Buffer.from(cacheItem.body));
            res.end(cacheItem.body);
            return;
        }

        const reqInfos = {
            url: req.getUrl(),
            host: req.getHeader('host'),
            query: req.getQuery(),
            method: req.getMethod(),
            ip: getIP(req, res),
            headers: {},
            HEADERS: {ip: getIP(req, res)}, //compatibility layer with old backend code
            req: req,
        };

        const serverConfig = { debug: false, watch: false };

        const appConfig = {
            "publicFolder": "./public",
            "root": "./"
        };

        memory.setObject("AdminConfig", serverConfig, "GLOBAL");

        let processResult = await staticFiles.process(appConfig, reqInfos, res, req, memory, { serverConfig }, app);

        //spa mode, redirect all 404 to index page
        if (!processResult.processed) {
            if (reqInfos.url.indexOf('?') > -1 )
            {
                reqInfos.url = "/index.html?" + reqInfos.url.split('?')[1];
            }
            else{
                reqInfos.url = "/index.html";
            }
            processResult = await staticFiles.process(appConfig, reqInfos, res, req, memory, { serverConfig }, app);
        }

        /*
        if (!processResult.processed) {
            processResult = {
                status: 404,
                headers: {
                    "cache-control": "public, max-age=30",
                    "expires": new Date(Date.now() + 30 * 1000).toUTCString(),
                    "last-modified": new Date(Date.now()).toUTCString(),
                    "content-type": "text/html;charset=utf-8;",
                }
            }
            processResult.content = "404 - Page not found";

            //set cache, keep cache on 404 to avoid DOS
            staticCache[cacheKey] = {};
            staticCache[cacheKey].status = "404";
            staticCache[cacheKey].headers = processResult.headers;
            staticCache[cacheKey].body = processResult.content;
        }
        */

        res.writeStatus("" + (processResult.status || 200));

        //add cors for some static files
        if ( reqInfos.url.indexOf("templates.json") > -1 ){
            processResult.headers["access-control-allow-headers"] = "Access-Control-Request-Method, Access-Control-Allow-Methods, Access-Control-Allow-Origin, Access-Control-Allow-Headers, Content-Type, Authorization, X-Requested-With, Cache-Control, Accept, Origin, X-Session-ID, server-token, user-token";
            processResult.headers["access-control-allow-methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
            processResult.headers["access-control-allow-origin"] = "*";            
        }
        

        for (var key in processResult.headers) {
            res.writeHeader(key, processResult.headers[key] + "");
        }

        //set cache
        staticCache[cacheKey] = {};
        staticCache[cacheKey].timestamp = globalTimestamp;
        staticCache[cacheKey].status = "" + (processResult.status || 200);
        staticCache[cacheKey].headers = processResult.headers;
        staticCache[cacheKey].body = processResult.content;
        
        //sharedMemory.setString(cacheKey, JSON.stringify(staticCache[cacheKey]), "staticCache");

        //console.log("orig: ", processResult.content)
        res.end(processResult.content);

        return;
    });


    //Load all api controllers
    if (apiconfig && Object.keys(apiconfig.REST).length) {
        for (let [key, config] of Object.entries(apiconfig.REST)) {

            if ( config.method == null ){
                config.method = "any";
            }

            //if no path is provided, use the key as the path (js code must be in the expected physical path in that case)
            if ( config.path == null ){
                config.path = key;
            }

            if ( key == "global" ){
                continue; //skip, this is global configuration
            }

            const method = (config.method).toLowerCase().replace("delete", "del") || 'post';

            let controller = null;
            try{
                var functionPath = safeJoinPath(__dirname, config.path);
                controller = require(functionPath);
                if (threadId == 1) {
                    //console.log("load route from apiconfig.json: " + key);
                }
            }
            catch(ex){
                if (threadId == 1) {
                    console.log("Unable to load route from apiconfig.json: " + key);
                }
            }
            

            app[method](key, async (res, req) => {

                res.onAborted(() => {
                    res.aborted = true;
                });

                // Global globalPreMiddleWare
       
                try {
                    var beginPipeline = process.hrtime();

                    var isValidReq = false;
                    var event = null;
                    var cacheKey = req.getUrl() + "?" +  req.getQuery();

                    if ( method == "get"){
                        if (staticCache[cacheKey] != null && globalTimestamp < staticCache[cacheKey].timestamp + cacheDuration_api ) {
                            isValidReq = true;
                            event = staticCache[cacheKey].body;
                            //console.log("from api cache")
                        }
                    }

                    if ( event == null ){
                        //not served from cache
                        var { isValidReq, event } = await api.requestParser(res, req, config);
                        //console.log("fresh serve")
                    }
                    

                    if (!isValidReq) {
                        return;
                    }

                
                    if ( method == "get" ) {
                        staticCache[cacheKey] = {};
                        staticCache[cacheKey].timestamp = globalTimestamp;
                        staticCache[cacheKey].body = event;
                    }

                    //console.log(controller.toString())
                    let response = await controller(event);

                    const nanoSeconds = process.hrtime(beginPipeline).reduce((sec, nano) => sec * 1e9 + nano);
                    var durationMS = (nanoSeconds/1000000);

                    api.sendResponse(res, response, durationMS, event);
                    

                } catch(ex){
                    console.log(ex.message)
                    console.log(ex.stack)
                }
                                
                
            });

            //WS
            if (apiconfig && Object.keys(apiconfig.WEBSOCKET).length) {
                for (let [key, config] of Object.entries(apiconfig.WEBSOCKET)) {

                    var functionPath = safeJoinPath(__dirname, config.path);
                    var wsController = require(functionPath);
                    //var wsController = require("." + config.path);
                    app.ws(key, {
                        open: (ws) => {
                            //console.log('A WebSocket connected!');
                            wsController.open(ws);
                        },
                        upgrade: (res, req, context) => {
                            wsController.upgrade(res, req, context);
                        },
                        message: (ws, message, isBinary) => {
                            
                            if (!isBinary){
                                message = decodeURIComponent(ab2str(message));
                            }

                            wsController.message(WSThreadSafeUtility(app), ws, message, isBinary);
                        },
                        drain: (ws) => {
                            console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
                        },
                        close: (ws, code, message) => {
                            wsController.close(ws, code, message);
                        }
                    });
                }
            }
            
            
            //cors (METHOD OPTION)
            app.options(key, async (res, req) => {
                var response = {};
                response.httpStatus = "200";
                response.content = "";
                api.sendResponse(res, response);
            });
        }
    }


    //allow cors for special paths
    //handleCorsFor(app, "/json/templates.json");
   
    var finalPort = port;
    if (sslActivated == "1") {
        finalPort = SSL_PORT;
    }

    //start listening
    app.listen(parseInt(finalPort), (token) => {
        if (token) {
            console.log('Listening to port ' + finalPort + ' from thread ' + threadId);
        } else {
            console.log('Failed to listen to port ' + finalPort + ' from thread ' + threadId);
        }
    });
}


function handleCorsFor(app, path){
    app.options(path, async (res, req) => {
                
        var response = {};
        response.httpStatus = "200";
        response.content = "";
        api.sendResponse(res, response);
        
    });
}


//multithread communication
var parentPort = null;
try {
    parentPort = require('worker_threads').parentPort;
} catch (ex) { }
if (parentPort != null) {
    parentPort.on('message', (msg) => {
        var clusteredProcessIdentifier = require('os').hostname() + "_" + require('worker_threads').threadId;
        if (msg.source == clusteredProcessIdentifier) {
            // same computer, let's discard it!
            // console.log("Thread replication discarded because it's from the same origin!");
        }
        else if (msg.type == "CG_WS_MSG") {
            app.publish(msg.channel, msg.message);
            // console.log("msg received: ");
            // console.log(msg);
        }
    });
}

//prevent global crash
process.on('uncaughtException', function (err) {
    if (!err.toString().startsWith("Invalid access of ")) {
        console.log("uncaughtException");
        console.log(err);
        console.log(err.message);
        console.log(err.stack);
    }
})

function ab2str(buf) {
    //return String.fromCharCode.apply(null, new Uint8Array(buf));
    if ( typeof buf == "string" ){
        return buf
    }
    else{
        
        //return (new TextDecoder().decode(buf));

        //change to be compatible with node 10 and below
        return String.fromCharCode.apply(null, new Uint8Array(buf));
    }
}

function WSThreadSafeUtility(app) {
    return {
        publish: function (channel, msg) {

            //publish on the current Thread
            app.publish(channel, msg);

            //send a copy to other threads
            if (parentPort != null) {
                var clusteredProcessIdentifier = require('os').hostname() + "_" + require('worker_threads').threadId;
                var content = msg;
                var obj = { type: "CG_WS_MSG", channel: channel, message: content, source: clusteredProcessIdentifier };
                parentPort.postMessage(obj);
            }
        }
    };
};



function safeJoinPath(...paths) {
   return path.join(...paths).replace(/\\/g, "/");
}


