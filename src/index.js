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
    this.app = express();
    this.app.get('/doors', (req, res) => {
      res.json(this.doors);
    });
    this.app.get('/doors/:id/ack', (req, res) => {
      if (this.doors[req.params.id]) {
        this.doors[req.params.id].ackedAt = new Date();
      }
      res.json(this.doors);
    });
    this.app.listen(8080, () => { this.startUp(); });
  }

  startUp() {
    console.log(process.env.HOSTNAME);
    this.sendMessage(['Starting up.',
      'POLLING_INTERVAL=' + this.pollingIntervalMinutes,
      'NOTIFY_INTERVAL=' + this.notifyIntervalMinutes
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
            console.info('Garage door ', device.serial_number, ' is now open.');
            door.openAt = new Date();
          }

          const openAgeMinutes = Math.round(((new Date()) - door.openAt) / 60 / 1000);

          if (openAgeMinutes && (openAgeMinutes % this.notifyIntervalMinutes === 0) && // open too long AND
            (!door.ackedAt || door.ackedAt > door.openAt) // not acked
          ) {
            this.sendMessage(`Garage door ${device.serial_number} has been open for ${openAgeMinutes} minutes.`);
          }
        } else {
          // door is closed
          if (door.openAt) {
            // was open, now closed, so delete openAt from the state object
            this.sendMessage(`Garage door ${device.serial_number} is now closed.`);
            delete door.openAt;
          }
        }
      }
    });
  }
};
