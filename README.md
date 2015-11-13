NodeJS-Chat
===========

NodeJS based chat App

Live Demo: https://hardorange-chat.herokuapp.com/

To run:
- Clone repo
- Run ```npm install```
- Run ```grunt``` to compile JavaScript and CSS Files
- Create a ```config.js``` using ```_config.js``` as a template
- Set desired server port in ```config.js```
- Set ```github secret_key``` (if you want to use the [Github Webhook](https://developer.github.com/webhooks/))
- Run ```node app.js```

Note: To maintain total mobile compatibility this app must not be run directly on port 80. This is due to some cellular provides filtering non-http traffic through port 80, including traffic such as web-sockets which this app requires to run. Therefore, I recommend using a reverse-proxy such as nginx to redirect requests to another port of your choice.
