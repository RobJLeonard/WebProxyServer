//Require libraries
const http = require("http");
const url = require("url");
const net = require('net');
const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const LRU = require('./LRU_Cache');

// Setup Configuration
try {
    var config = JSON.parse(fs.readFileSync("config.json"));
} catch (error) {
    console.log('config.json not found creating file with default values.');
    settings = JSON.stringify({ "host": "127.0.0.1", "port": "80", "blacklist": [] });

    fs.writeFileSync('./config.json', settings);
    var config = JSON.parse(fs.readFileSync("config.json"));
}

var host = config.host,
    port = config.port,
    blacklist = config.blacklist;

var cache = new LRU(20);

// Setup Cache File
// try {
//     var cache = JSON.parse(fs.readFileSync("cache.json"));
// } catch (error) {
//     console.log('cache.json not found creating cache file.');
//     let body = JSON.stringify({});
//     fs.writeFileSync('./cache.json', body);
//     var cache = JSON.parse(fs.readFileSync("config.json"));
// }


/*---------------------------------------------WATCH CONFIG------------------------------------------------*/

//Dynamically change the host, port, and blacklist if they are changed in the config file
fs.watchFile("config.json", function () {
    updateConfig();
});

function updateConfig() {
    config = JSON.parse(fs.readFileSync("config.json"));
    host = config.host;
    port = config.port;
    blacklist = config.blacklist;
    server.close();
    server.listen(port, host);
    return readCommand();
}

/*---------------------------------------------HTTP SERVER------------------------------------------------*/

//Create the proxy
var server = http.createServer((browserRequest, browserResponse) => {

    //Proxy Request handler
    browserRequest.on('data', (chunk) => {
        //Request coming from the broswer gets passed through the proxy server to the server
        proxyRequest.write(chunk, 'binary');
    });

    browserRequest.on('end', () => {
    });

    proxy_url = url.parse(browserRequest.url, true);

    //Check if host is in Blacklist
    blacklist.forEach(blacklistedHost => {
        if (blacklistedHost === proxy_url.host) {
            console.log("\x1b[31m", "DENIED (" + blacklistedHost + ") " + browserRequest.method + " " + browserRequest.url);
            browserResponse.writeHead(403);
            return browserResponse.end("<h1>This domain has been blacklisted from the Proxy.<h1>");
        }
    });

    //Print out recieved request
    let request = browserRequest.url.split(':');
    var s_domain = request[0];
    var s_port = request[1]
    console.log("\x1b[32m", "Request recieved for:" + s_domain + ":" + s_port); readCommand();

    //Served cached data if available
    //let cache = JSON.parse(fs.readFileSync("cache.json"));

    if (cached(browserRequest.url)) {
        console.log("\x1b[33m", "Serving cached data for " + browserRequest.url); readCommand();

        cachedBrowserRequest = cache.read(browserRequest.url);

        //var chunks = JSON.stringify(cache[browserRequest.url].data);
        var chunks = JSON.stringify(cachedBrowserRequest.data);
        cacheBuffer = new Buffer(JSON.parse(chunks));
        

        cachedBrowserRequest.header['content-length'] = cacheBuffer.length;
        cachedBrowserRequest.header['accept-encoding'] = browserRequest.headers['accept-encoding'];

        browserResponse.writeHead(cachedBrowserRequest.status, cachedBrowserRequest.header);
        browserResponse.write(cacheBuffer);

        return browserResponse.end();
    }

    //Create variable for caching responses to the http request
    var body = [];

    //Create Request
    var proxyRequest = http.request({
        port: 80,
        host: proxy_url.host,
        method: browserRequest.headers['method'],
        path: proxy_url.path
    });
    proxyRequest.end();
    proxyRequest.on('error', console.log)

    //Proxy Response handler
    proxyRequest.on('response', (proxyResponse) => {

        //Store the body of the response in the body variable 
        proxyResponse.on('data', (chunk) => {
            body.push(chunk);
            browserResponse.write(chunk, 'binary');
        });

        //Cache the response body with it's url and herders for future use
        proxyResponse.on('end', () => {
            cacheData(browserRequest.url, body, proxyResponse.statusCode, proxyResponse.headers);
            browserResponse.end();
        });
        browserResponse.writeHead(proxyResponse.statusCode, proxyResponse.headers);
    });



}).listen(port, host, () => {
    console.log("\x1b[32m", "Now listening on: " + host + ":" + port);
    readCommand();
});


/*---------------------------------------------HTTPS LISTENER-----------------------------------------------*/

//Listen for connection requests from the browser
server.addListener('connect', (browserRequest, browserSocket, bodyhead) => {

    //Check if host is in Blacklist
    p_url = url.parse('https://' + browserRequest.url, true);
    for (i in blacklist) {
        if (p_url.hostname.search(blacklist[i]) != -1) {
            console.log("\x1b[31m", "DENIED (" + blacklist[i] + ") " + browserRequest.method + " " + browserRequest.url);

            //HERE IS CODE THAT NEEDS TO BE FIXED UP
            browserSocket.write("HTTP/" + browserRequest.httpVersion + " 403 Forbidden\r\n\r\n");
            browserSocket.end("<h1>This domain has been blacklisted<h1>");
            //

            return readCommand();
        }
    }

    var s_domain = browserRequest.url.split(':')[0];
    var s_port = browserRequest.url.split(':')[1]


    //TODO
    //IMPLEMENT CACHING OVER SOCKETS

    // console.log("\x1b[32m", "Request recieved for:" + s_domain + ":" + s_port); readCommand();

    // if (cached(browserRequest.url)) {
    //     console.log("\x1b[33m", "Serving cached data for " + browserRequest.url); readCommand();

    //     cachedBrowserRequest = cache.read(browserRequest.url);

    //     browserSocket.write(cachedBrowserRequest.data);
        

    //     cachedBrowserRequest.header['content-length'] = cacheBuffer.length;
    //     cachedBrowserRequest.header['accept-encoding'] = browserRequest.headers['accept-encoding'];

    //     browserResponse.writeHead(cachedBrowserRequest.status, cachedBrowserRequest.header);
    //     browserResponse.write(cacheBuffer);

    //     return browserResponse.end();
    // }

    //Create proxy-server socket and establish a connection with the server
    var proxySocket = new net.Socket();
    proxySocket.connect(s_port, s_domain, function () {
        proxySocket.write(bodyhead);
        browserSocket.write("HTTP/" + browserRequest.httpVersion + " 200 Connection established\r\n\r\n");
    }
    );

   //Create variable for caching responses to the https request
   // var body = [];

   
    //Tunnel data from each socket out the other
    browserSocket.on('data', (chunk) => {
        proxySocket.write(chunk);
    });
    proxySocket.on('data', (chunk) => {
        //Cache data here to pass to browser
        //body.push(chunk);
        browserSocket.write(chunk);
    });

     //Finish browser-proxy socket when proxy-server socket is finished or breaks
     proxySocket.on('end', () => {
        //cacheHTTPSData(browserRequest.url, body, proxySocket.statusCode, proxySocket.headers);
        browserSocket.end();
    });
    proxySocket.on('error', () =>{
        browserSocket.write("HTTP/" + browserRequest.httpVersion + " 500 Connection error\r\n\r\n");
        browserSocket.end();
    });

    //Finish proxy-server socket when browser-proxy socket is finished or breaks
    browserSocket.on('end', () => {
        proxySocket.end();
    });
    browserSocket.on('error', () => {
        proxySocket.end();
    });

});


/*-------------------------------------------------CACHE---------------------------------------------------*/

//Dynamically change the host, port, and blacklist if they are changed in the config file
fs.watchFile("cache.json", () => {
    updateCache();
});

function updateCache() {
    cache = JSON.parse(fs.readFileSync("cache.json"));
    return readCommand();
}

//Checks if a url is cached
function cached(url) {
    //let cache = JSON.parse(fs.readFileSync("cache.json"));
    return (cache.read(url)) ? true : false;
}

//Puts header and data for response to a url into the cache
function cacheData(url, data, status, header) {

    //Checks response for a cache-control option 
    if (header['cache-control']) {
        for (i in header['cache-control'].split(',')) {
            //If header specifies not to cache then do not cache
            if (header['cache-control'].split(',')[i].search('no-cache') != -1) {
                return;
            }
        }
    }


    cache.write(url, { "header": header, "status": status, "data": data.toString() })

    //c = JSON.parse(fs.readFileSync("cache.json"));
    console.log("\x1b[33m", "Caching url: " + url)

    //c[url] = { "header": header, "status": status, "data": data.toString() };


    //str = JSON.stringify(c);
    // if (isJSON(str)) {
    //     //var ws = fs.createWriteStream('cache.json');
    //    // ws.write(str);
    // }
    // else {
    //     console.log("\x1b[31m", "Not valid JSON anymore");
    // }
}

//Puts header and data for response to a url into the cache
function cacheHTTPSData(url, data, status, header) {

    cache.write(url, { "header": header, "status": status, "data": data.toString() })

    console.log("\x1b[33m", "Caching url: " + url)
}


//Checks if text is valid JSON
function isJSON(text) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

/*---------------------------------------------MANAGEMENT CONSOLE-----------------------------------------------*/

//Read in commands from the management console
function readCommand() {
    rl.setPrompt("\x1b[32m", '>');
    rl.prompt();
}
rl.on('line', function (c) {
    var args = c.split(' ');
    switch (args[0]) {
        case "help": help(); break;
        case "blacklistrm": blacklistRm(args); break;
        case "blacklist":
            if (args.length > 1) {
                blacklistFunc(args); break;
            }
            else {
                console.log("\x1b[32m", "The current blacklist is:\n[" + blacklist + "]"); readCommand(); break;
            }
        case "clearcache": clearCache(); break;
        case "quit": quit(); break;
        case "status": status(); break;
        case "port": changeport(args); break;
        case "host": changepost(args); break;
        default: help(); break;
    }
});


/*-----------------------HELP----------------------*/
function help() {
    console.log("\x1b[32m", "\n\thelp: displays proxy commands\n\n\tblacklist: displays blacklist\n\n\tblacklist <domain>: blacklists x domains\n\n\tclearcache: clears the cache\n\n\tquit: terminates the proxy\n\n\tport <port number>: updates the port number of the proxy\n\n\thost <host address>: updates the host address of the proxy\n");
    readCommand();
}


/*---------------------STATUS----------------------*/
function status() {
    console.log("\x1b[32m", "host:\t\t" + host + "\nport:\t\t" + port + "\nblacklist:\t" + blacklist);
    readCommand();
}


/*-----------------------QUIT----------------------*/
function quit() {
    server.close(); abort();
}


/*------------------CLEARCACHE--------------------*/
function clearCache() {
    fs.writeFile('cache.json', "{}", (err) => {
        if (err) throw err;
    });
    readCommand();
}


/*--------------------BLACKLIST--------------------*/
//BlackLists a url from the proxy, unless it is already blacklisted
function blacklistFunc(args) {
    for (var j = 1; j < args.length; j++) {
        var added = false;
        for (i in blacklist) {
            if (blacklist[i] === args[j]) {
                console.log("\x1b[31m", 'The domain ' + args[j] + ' was already blacklisted.'); readCommand(); added = true; break;
            }
        }
        if (!added) {
            blacklist.push(args[j]);
        }
    }

    var c = JSON.parse(fs.readFileSync("config.json"));

    c.blacklist = blacklist

    fs.writeFile('config.json', JSON.stringify(c), (err) => {
        if (err) throw err;
        readCommand();
    });
}

/*-----------------BLACKLISTRM----------------------*/
//Removes domains from the proxy's blacklist if they are present
function blacklistRm(args) {

    for (var j = 1; j < args.length; j++) {
        var removed = false;
        for (i in blacklist) {
            if (blacklist[i] === args[j]) {
                blacklist.splice(i, 1);
                console.log("\x1b[32m", 'The domain ' + args[j] + ' was removed from the blacklist.'); readCommand(); removed = true; return;
            }
        }
        if (!removed) {
            console.log("\x1b[31m", 'The domain ' + args[j] + ' was not in the blacklist.'); readCommand();
        }
    }

    var c = JSON.parse(fs.readFileSync("config.json"));

    c.blacklist = blacklist;

    fs.writeFile('config.json', JSON.stringify(c), (err) => {
        if (err) throw err;
        readCommand();
    });
}

/*-------------------CHANGEPORT--------------------*/
//Changes the port of the proxy
function changeport(args) {

    var c = JSON.parse(fs.readFileSync("config.json"));

    c.port = args[1];

    fs.writeFile('config.json', JSON.stringify(c), (err) => {
        if (err) throw err;
        console.log("\x1b[31m", 'The port number was updated to:' + args[1]);
        readCommand();
    });
}

/*-------------------CHANGEHOST-------------------*/
//Changes the host address of the proxy
function changehost(args) {

    var c = JSON.parse(fs.readFileSync("config.json"));

    c.host = args[1];

    fs.writeFile('config.json', JSON.stringify(c), (err) => {
        if (err) throw err;
        console.log("\x1b[31m", 'The host address was updated to:' + args[1]);
        readCommand();
    });
}