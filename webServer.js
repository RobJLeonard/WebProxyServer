const http = require('http');
var url = require('url');
var request = require('request');


const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  var queryData = url.parse(req.url, true).query;
    if (queryData.url) {
        request({
            url: queryData.url
        }).on('error', function(e) {
            res.end(e);
        }).pipe(res);
    }
    else {
        res.end("no url found");
    }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});