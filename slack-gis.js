var config = require('./config');
var http = require('http');
var qs = require('qs');
var gis = require('g-i-s');
var probable = require('probable');
var pickFirstGoodURL = require('pick-first-good-url');
var callNextTick = require('call-next-tick');
var compact = require('lodash.compact');

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

    // for some reason, g-i-s lib doesn't like the hash symbol,
    // so let's replace it here
    parsed.text = parsed.text.replace("#","%23")

    console.log("calling with search text: '" + parsed.text + "'")
    gis(parsed.text, respondWithImages);
  }

  function respondWithImages(error, images) {
    if (error) {
      console.log(error);
      res.writeHead(200, headers);
      res.end();
    }
    else {
      var goodImages = compact(images);
      var imageURLs;
      console.log("resopnded with results: '" + images + "'")
      if (parsed.index > 0) {
        //normalize from 1 based cmd
        writeImageToResponse(null, images[parsed.index-1])
      }
      else
      {
        if (probable.roll(2) === 0) {
          imageURLs = probable.shuffle(images);
        }
        else {
          imageURLs = probable.shuffle(images.slice(0, 10));
        }

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
    } else {
      response.text = '¯\\_(ツ)_/¯';
    }
    console.log("returning text: '" + response.text + "'")
    res.writeHead(200, headers);
    response.text = response.text.replace(/%25/g, "%") // replace all %25 to %
    res.end(JSON.stringify(response));
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


const randomWord = require('random-word');

function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

function hehehe(str)
{


  var modifiers = [" girls", " -girls", " three girls", " boobs", " butt", " bob sagat"]

  var x = randomInt(0,modifiers.length + 1);
  console.log(x)
  var modStr = ''
  if (x == modifiers.length)
  {
    modStr += randomWord();
  }
  else {
    modStr = modifiers[randomInt(0,modifiers.length)];
  }

  console.log(modStr);
  return str + modStr;
}

function getSearchTextAndIndex(messageText) {

  var gisTrigger = /^gis[\d+]*/i
  var imageIndex = 0;
  match = gisTrigger.exec(messageText);
  // match is guaranteed to succeed, because trigger is 'gis'
  matchIndex = /[\d]+/.exec(match) //do we have an index?

  if (matchIndex != null)
  {
    // we have a valid index
    imageIndex = match[0].replace(/^gis/i, '')
      messageText = messageText.replace(gisTrigger, '')
      messageText = messageText.substr(1)
      var test = 1;
      if (test)
      {
        messageText = hehehe(messageText)
      }
    console.log("valid index: " + imageIndex)
  }
  else
  {
    // no index!
    console.log("no index")
      messageText = messageText.replace(/^gis/i, '')
      if (messageText.charAt(0) === ' ')
      {
        messageText = messageText.substr(1);
      }
  }

  return {text: messageText, index: imageIndex};
}

http.createServer(takeRequest).listen(config.webhookPort);

console.log('Webhook server listening at port:', config.webhookPort);
