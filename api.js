const qs = require('querystring');
const { getBody, getIP, GzipContent } = require("@elestio/cloudgate/modules/tools");
const coregate = require('@elestio/cloudgate/coregate.js');

var zlib = require('zlib');

var apiConfig = require("./apiconfig.json");
var APIKEY = process.env.NEBULA_REST_API_KEY;


exports.setCors = (res) => {
    res.writeHeader("access-control-allow-headers", "Access-Control-Request-Method, Access-Control-Allow-Origin, Access-Control-Allow-Headers, Content-Type, Authorization, X-Requested-With, Cache-Control, Accept, Origin, X-Session-ID, server-token, user-token");
    res.writeHeader("access-control-allow-headers", "Access-Control-Request-Method, Access-Control-Allow-Methods, Access-Control-Allow-Origin, Access-Control-Allow-Headers, Content-Type, Authorization, X-Requested-With, Cache-Control, Accept, Origin, X-Session-ID, server-token, user-token");
    res.writeHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.writeHeader("access-control-allow-origin", "*");
    res.writeHeader("access-control-max-age", "600");
}

exports.sendResponse = (res, response = {}, durationMS, event) => {

    try{
        // Send response
        if ( response.httpStatus != null ){
            res.writeStatus(response.httpStatus + "");
        }
        else {
            res.writeStatus("200");
        }

        if ( response.headers == null ){
            response.headers = {};
        }

        if (!response.contentType && response.headers["content-type"] == null && response.headers["Content-Type"] == null  ) {
            response.contentType = "application/json;charset=utf-8;"
        }

        //no content returned!
        if (!response.content) {
            //console.log(response);
            response.content = { status: "ok" };
        }

        if (typeof response.content == "object") {
            response.content = JSON.stringify(response.content);
        }

        if ( durationMS ){
            res.writeHeader("durationMS", durationMS + "ms");
        }

        //Set CORS headers
        this.setCors(res);

        //write headers returned in the response
        if ( response.headers != null ){
            for (var key in response.headers) {
                if ( key.toLowerCase() != "content-length" ){
                    res.writeHeader(key, response.headers[key] + ""); //force casting the header value to string, other data types are not allowed in headers
                }
            }
        }
        
        if (response.headers == null || response.headers["content-type"] == null){
            res.writeHeader("content-type", response.contentType);
        }

        try{

            //return without compression, now handled by Cloudflare reverse proxy
            //res.end(response.content);

            //Adding compression if supported
            //Too slow, disabled for now ... done by Cloudflare reverse proxy
            
            var acceptEncoding = "";
            if ( event != null && event.headers["accept-encoding"] != null ){
                acceptEncoding = event.headers["accept-encoding"].toLocaleLowerCase();
            }
            if ( acceptEncoding.indexOf('br') > -1 ){
                if (response.headers == null || response.headers["content-encoding"] == null){
                    res.writeHeader("content-encoding", "br");
                }
                res.end(zlib.brotliCompressSync(response.content));
            }
            else if ( acceptEncoding.indexOf('gzip') > -1 ){
                if (response.headers == null || response.headers["content-encoding"] == null){
                    res.writeHeader("content-encoding", "gzip");
                }
                res.end(zlib.gzipSync(response.content));
            }
            else if ( acceptEncoding.indexOf('deflate') > -1 ){
                if (response.headers == null || response.headers["content-encoding"] == null){
                    res.writeHeader("content-encoding", "deflate");
                }
                res.end(zlib.deflateSync(response.content));
            }
            else{
                //no encoding, plain
                res.end(response.content);
                //res.end(zlib.gzipSync(response.content));
            }
            
        }
        catch(ex){
            console.log("error in sendResp: ", ex)
        }
    }
    catch(exGlobal){
        //let's ignore closed sockets errors
        if (exGlobal.message.indexOf("Invalid access of discarded") == -1){
            console.log("exGlobal: ", exGlobal);
        }
    }
    
    return;
}

exports.requestParser = async (res, req, apiEndpoint) => {

    let finalQueryObj = {}, FILES = [], isValidReq = true;

    let reqInfos = {
        url: req.getUrl(),
        query: req.getQuery(),
        method: req.getMethod(),
        ip: getIP(req, res),
        headers: {}
    };

    req.forEach((k, v) => {
        reqInfos.headers[k] = v;
    });

    //read the body only if needed
    if (reqInfos.method != "get") {
        reqInfos.body = await getBody(req, res, true);
    }

    const contentType = reqInfos.headers['content-type'];

    if (reqInfos.method === 'get') {
        finalQueryObj = parseURLEncParams(reqInfos.query);
    } else {
        if (contentType != null && Object.keys(bodyParserTool).includes(contentType.split(';')[0])) {
            finalQueryObj = bodyParserTool[contentType.split(';')[0]](reqInfos.body);
        }
        else if (contentType != null && contentType.indexOf("multipart/form-data") > -1) {
            let eventTemp = { "httpMethod": reqInfos.method.toUpperCase() };
            eventTemp[reqInfos.method.toUpperCase()] = {};

            parseFormData(reqInfos.body, contentType, eventTemp); //mutate the event to add FILES & POST
            finalQueryObj = eventTemp[eventTemp.httpMethod];
            FILES = eventTemp.FILES;
        }
        else {
            finalQueryObj = parseAppJsonBody(reqInfos.body);
        }
    }


    if (apiEndpoint.isPrivate) {
        if ((!finalQueryObj.apiKey || finalQueryObj.apiKey !== APIKEY) && (reqInfos.headers['x-api-key'] != APIKEY )) {
            isValidReq = false;
            this.sendResponse(res, {
                httpStatus: "403",
                content: '{"status": "KO", "code": "BAD_API_KEY", "details": "Wrong or no apiKey received."}'
            });
        }
        delete finalQueryObj.apiKey;
    }

    var missingParameters = [];
    if (isValidReq && apiEndpoint.parametersList) {
        for (let i = 0; i < apiEndpoint.parametersList.length; i++) {
            const param = apiEndpoint.parametersList[i];
            if (!finalQueryObj.hasOwnProperty(param)) {
                isValidReq = false;
                //break;

                missingParameters.push(param);
            }
        }

        if (!isValidReq) {
            this.sendResponse(res, {
                httpStatus: "400",
                content: {
                    status: "KO",
                    code: "MissingMandatoryParams",
                    list: missingParameters
                }
            });
        }
    }

    let event = {
        httpMethod: reqInfos.method.toUpperCase(),
        method: reqInfos.method.toUpperCase(),
        url: reqInfos.url,
        path: reqInfos.url,
        ip: reqInfos.ip,
        query: reqInfos.query,
        queryStringParameters: qs.parse(reqInfos.query),
        body: reqInfos.body,
        headers: reqInfos.headers
    };

    event[event.httpMethod] = finalQueryObj;
    event.FILES = FILES;

    return { isValidReq, event };
}

const parseAppJsonBody = (body) => {
    try {
        body = JSON.parse(body);
    } catch (err) {
        body = {};
    }
    return body;
};

const parseURLEncParams = (body) => {
    body = body.toString('utf8');
    body = new URLSearchParams(body);
    let finalBody = {};
    for (const [key, value] of body) {
        finalBody[key] = value;
    }
    return finalBody;
};

const bodyParserTool = {
    'application/json': parseAppJsonBody,
    'application/x-www-form-urlencoded': parseURLEncParams
};

const parseFormData = (body, contentType, event) => {
    var files = [];
    var keyValues = [];
    var parts = coregate.getParts(body, contentType);

    for (var i = 0; i < parts.length; i++) {
        var curPart = parts[i];

        if (curPart["filename"] != null) {
            files.push(curPart);
        }
        else {
            //set key/values directly on the event.POST/PUT/PATCH
            event[event.httpMethod][curPart["name"]] = Buffer.from(curPart["data"]).toString();
        }
    }


    event.FILES = files;
    return event;
}