'use strict';

const MQ = require('@hjdhjd/myq').myQApi;
const Twilio = require('twilio');
const express = require('express');

module.exports = class garageMonitor {
  constructor() {
    this.populateEnvironment();
    this.myQ = this.getMyQClient();
    this.twilio = this.getTwilioClient();
    this.doors = {};
    this.sendSms = process.env.SEND_SMS === 'true';
    this.pollingIntervalMinutes = process.env.MYQ_POLLING_INTERVAL_MINUTES || 1;
    this.notifyIntervalMinutes = process.env.MYQ_NOTIFY_INTERVAL_MINUTES || 10;
    this.expressPort = process.env.HTTP_LISTEN_PORT || 8080;

    this.urlBase = new URL(process.env.URL_BASE || `http://${process.env.HOSTNAME}.local:${this.expressPort}`);
    this.app = express();
    this.app.get('/doors', (req, res) => {
      res.json(this.doors);
    });
    this.app.get('/doors/:id/ack', (req, res) => {
      if (this.doors[req.params.id]) {
        this.doors[req.params.id].ackedAt = new Date();
        console.info(`Received ack for door ${req.params.id}.`);
      }
      res.set('Content-Type', 'text/plain');
      res.send(`OK\n${JSON.stringify(this.doors, null, 2)}`);
    });
  }

  startUp() {
    this.app.listen(this.expressPort, () => { this.startPoller(); });
  }

  startPoller() {
    this.sendMessage(['Starting up.',
      'POLLING_INTERVAL=' + this.pollingIntervalMinutes,
      'NOTIFY_INTERVAL=' + this.notifyIntervalMinutes,
      'URL_BASE=' + this.urlBase.href
    ].join(' '));

    // initial run
    this.refreshState();

    // interval run
    setInterval(this.refreshState.bind(this),
      (this.pollingIntervalMinutes) * 60 * 1000); // convert minutes to ms
  }

  populateEnvironment() {
    require('dotenv').config();

    // ensure we have env vars we need
    for (const reqEnv of [
      'TWILIO_ACC_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_MSG_SVC_SID',
      'TWILIO_TO',
      'MYQ_USER',
      'MYQ_PASS'
    ]) {
      if (!process.env[reqEnv]) {
        console.error(`Env var ${reqEnv} is not defined.`);
        process.exit(1);
      }
    }
  }

  getMyQClient() {
    return new MQ(process.env.MYQ_USER, process.env.MYQ_PASS);
  }

  getTwilioClient() {
    const accountSid = process.env.TWILIO_ACC_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    return Twilio(accountSid, authToken);
  }

  sendMessage(body) {
    if (this.sendSms) {
      this.twilio.messages
        .create({
          body: body,
          messagingServiceSid: process.env.TWILIO_MSG_SVC_SID,
          to: process.env.TWILIO_TO
        })
        .then(message => console.info(`Sent SMS <${message.sid}> :: ${body}`))
        .done();
    } else {
      console.info(`Would have sent SMS :: ${body}`, this.doors);
    }
  }

  refreshState() {
    console.info('Refreshing state');
    this.myQ.refreshDevices().then(() => {
      if (!this.myQ.devices) {
        console.warn('No devices found.');
        return;
      }
      for (const device of this.myQ.devices) {
        // console.debug(device);
        if (device.device_family !== 'garagedoor') { continue; }
        if (!device.state) {
          console.warn('WEIRD: garagedoor does not have state. Device:', device);
          continue;
        }
        // init door obj
        if (!this.doors[device.serial_number]) {
          this.doors[device.serial_number] = {};
        }
        const door = this.doors[device.serial_number];

        // door state
        const doorState = device.state.door_state;
        door.state = doorState;

        if (doorState !== 'closed') {
          if (!door.openAt) {
            // not already known as open
            console.info(`Garage door ${device.serial_number} is now open.`);
            door.openAt = new Date();
          }

          const openAgeMinutes = Math.round(((new Date()) - door.openAt) / 60 / 1000);

          if (openAgeMinutes && (openAgeMinutes % this.notifyIntervalMinutes === 0) && // open too long AND
            (!door.ackedAt || door.ackedAt < door.openAt) // not acked
          ) {
            const ackUrl = new URL(this.urlBase.href);
            ackUrl.pathname = `/doors/${device.serial_number}/ack`;
            this.sendMessage(`Garage door ${device.serial_number} has been open for ${openAgeMinutes} minutes. ACK: ${ackUrl.href}`);
            door.notifiedAt = new Date();
          }
        } else {
          // door is closed
          if (door.openAt) {
            if (door.notifiedAt) {
              // notify if an open notif was sent
              this.sendMessage(`Garage door ${device.serial_number} is now closed.`);
            }
            // delete times from the state object
            delete door.openAt;
            delete door.ackedAt;
            delete door.notifiedAt;
          }
        }
      }
    });
  }
};
