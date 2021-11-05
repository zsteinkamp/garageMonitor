# garageMonitor

Monitor your myQ supported garage door (Chamberlain, Liftmaster) status and send you a notification if it was open more than N minutes.

You will need to set the following environment variables before running the commands below. You can paste the content below into a file called `.env` in the current directory if you like.

```
MYQ_USER="you@yourself.com"
MYQ_PASS="myqpassword"
SMTP_USER="smtpuser"
SMTP_PASS="smtppass"
SMTP_HOST="smtp.some.server"
SMTP_PORT=587
SMTP_FROM="you@yourself.com"
SMTP_TO="you@yourself.com"
```

You may want to use your text messaging email address for the `SMTP_TO`
variable. Poor man's push notifications. For example, if you are with AT&T,
then your text message email address is `{yourphonenumber}@txt.att.net`.

## Running
```
docker compose run app
```

## Developing
```
docker compose run dev
```
