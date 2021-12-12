# garageMonitor

Monitor your myQ supported garage door (Chamberlain, Liftmaster) status and send you a notification via Twilio if it was open more than N minutes.

You will need to set up a free Twilio account first. https://twilio.com/

Then will need to create a `.env` file in the top-level directory that looks like this:

```
MYQ_USER=you@yourself.com
MYQ_PASS=myqpassword

TWILIO_ACC_SID=...twilio account sid...
TWILIO_AUTH_TOKEN=...twilio auth token...
TWILIO_MSG_SVC_SID=...twilio message service id...
TWILIO_TO=+14085551212

URL_BASE=http://some-host:8080
```
## Polling Interval

By default, this code checks the status of your garage door every minute. You can change that by setting the following variable in `.env`.

```
MYQ_POLLING_INTERVAL_MINUTES=2
```

## Time Sensitivity
To control how long the garage needs to be open before you are notified, set the following environment variable. The default is 10 minutes.

```
MYQ_NOTIFY_INTERVAL_MINUTES=10
```

## URL Base
Notifications include a URL to acknowledge the alert to silence future alerts (e.g. if you are working in the garage for a long time). Set the `URL_BASE` environment variable (or .env entry) to customize the URL that is sent.

```
URL_BASE=http://some-host:8080
```

## Running the App

The app runs in a Docker container. It is set to restart if it crashes or when Docker starts up. Run this command to start it:

```
docker-compose up -d --build app
```

You can keep an eye on the logs from the app container with tihs command:

```
docker-compose logs -f app
```

To stop the app, run this:

```
docker-compose down
```

## Development Mode

In Development Mode, the app is run in a container with the source directory mounted inside. It is reloaded any time you change a source file.

```
docker-compose up --build dev
```
