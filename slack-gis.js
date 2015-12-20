var config = require('./config');
var http = require('http');
var qs = require('qs');
var gis = require('g-i-s');
var probable = require('probable');
var pickFirstGoodURL = require('pick-first-good-url');
var callNextTick = require('call-next-tick');


//override webhookPort for heroku

config.webhookPort = Number(process.env.PORT || 5000)


console.log('The slack-gis webhook server is running.');

function takeRequest(req, res) {
  console.log("request received!");
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(200, headers);
    res.end('OK');
  }
  else if (req.method === 'POST') {
    var body = '';
    req.on('data', function (data) {
      body += data;
    });

    req.on('end', function doneReadingData() {
      console.log("POST received. Body: " + body);
      respondToRequestWithBody(req, body, res, headers);
    });
  }
  else {
    res.writeHead(304, headers);
    res.end();
  }
}

function respondToRequestWithBody(req, body, res, headers) {
  headers['Content-Type'] = 'text/json';

  var params = qs.parse(body);
  console.log("params.token: " + params.token)

  if (config.validWebhookTokens.indexOf(params.token) === -1) {
    res.writeHead(404);
    res.end();
  }
  else if (params.user_name === 'slackbot') {
    // Don't respond to self; avoid infinite loops.
    res.writeHead(200);
    res.end();
  }
  else if (typeof params.text === 'string') {
    // Remove internal Slack user id references.
    console.log("chan text: '" + params.text + "'");
 
    var response = {
      username: 'google-image-search',
      channel: params.channel_id
    };

    parsed = getSearchTextAndIndex(params.text);    

    console.log("calling with search text: '" + parsed.text + "'")
    gis(parsed.text, respondWithImages);

    function respondWithImages(error, images) {
      if (error) {
        console.log(error);
        res.writeHead(200, headers);
        res.end();
      }
      else {
        console.log("resopnded with results: '" + images + "'")
        if (parsed.index > 0) {
          //normalize from 1 based cmd
          writeImageToResponse(null, images[parsed.index-1])
        } 
        else
        {
          var imageURLs = probable.shuffle(images);
          var pickOpts = {
            urls: imageURLs,
            responseChecker: isImageMIMEType
          };
          pickFirstGoodURL(pickOpts, writeImageToResponse);
        }
      }
    }

    
    function writeImageToResponse(error, imageURL) {
      
      if (imageURL) {
        response.text = imageURL;
      }
      else {
        response.text = '¯\\_(ツ)_/¯';
      }
      console.log("returning text: '" + response.text + "'")
      res.writeHead(200, headers);
      res.end(JSON.stringify(response));
    }
  }
}

function defined(value) {
  return value !== undefined;
}

function isImageMIMEType(response, done) {
  callNextTick(
    done, null, response.headers['content-type'].indexOf('image/') === 0
  );
}

function getSearchTextAndIndex(messageText) {

  var gisTrigger = /^gis[\d+]*/
  var imageIndex = 0;
  match = gisTrigger.exec(messageText);
  // match is guaranteed to succeed, because trigger is 'gis'
  matchIndex = /[\d]+/.exec(match) //do we have an index?

  if (matchIndex != null)
  {
    // we have a valid index
    imageIndex = match[0].replace(/^gis/, '')
      messageText = messageText.replace(gisTrigger, '')
      messageText = messageText.substr(1)
    console.log("valid index: " + imageIndex)
  }
  else
  { 
    // no index!
    console.log("no index")
      messageText = messageText.replace(/^gis/, '')
      if (messageText.charAt(0) === ' ')
      {
        messageText = messageText.substr(1);
      }
  }
  
  return {text: messageText, index: imageIndex};
}

http.createServer(takeRequest).listen(config.webhookPort);

console.log('Webhook server listening at port:', config.webhookPort);
