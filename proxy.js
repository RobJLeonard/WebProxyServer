var http = require('http'),
    url = require('url');

function notFound(res) {
    res.writeHead(404, "text/plain");
    res.end("404: File not found");
}

http.createServer((b_req, b_res) => {
    //Parse the request url
    var b_url = url.parse(b_req.url, true);
    

    b_path = b_url.path.substring(1,b_url.path.length)
	console.log(b_path || "No path given");
	
	if (!b_path)
		 return notFound(b_res);
		 
    // Read and parse the url parameter (/url)
    var p_url = url.parse(b_path);

    // Init HTTP Client
    var options = {
        port: p_url.port || 80
        , host: p_url.host || 'localhost'
        , method: 'GET'
        , path: p_url.pathname || '/'
    }

    var p_req = http.request(options);

    // Send Request
    p_req.end();

    // Listen for response
    p_req.addListener('response', (p_res) => {

        // Pass through headers
        b_res.writeHead(p_res.statusCode, p_res.headers);

        // Pass through data
        p_res.addListener('data', (chunk) => {
            b_res.write(chunk);
        });

        // End Request
        p_res.addListener('end', () => {
            b_res.end();
        });
    });
}).listen(3000, "127.0.0.1");

console.log("Server running at http://127.0.0.1:3000/")