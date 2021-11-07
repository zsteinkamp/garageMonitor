'use strict';

const MQ = require('@hjdhjd/myq').myQApi;
const Twilio = require('twilio');

module.exports = class garageMonitor {
  constructor() {
    this.populateEnvironment();
    this.myQ = this.getMyQClient();
    this.twilio = this.getTwilioClient();
    this.openDoors = {};
  }

  startUp() {
    // hello to you too
    this.sendMessage('Starting up.');

    // initial run
    this.refreshState();

    // interval run
    setInterval(this.refreshState,
      (process.env.MYQ_POLLING_INTERVAL_MINUTES || 1) * 60 * 1000);
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
        console.log(`ERROR: Env var ${reqEnv} is not defined.`);
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
    this.twilio.messages
      .create({
        body: body,
        messagingServiceSid: process.env.TWILIO_MSG_SVC_SID,
        to: process.env.TWILIO_TO
      })
      .then(message => console.log(`Sent SMS <${message.sid}> :: ${body}`))
      .done();
  }

  refreshState() {
    this.myQ.refreshDevices().then(() => {
      for (const device of this.myQ.devices) {
        // console.debug(device);
        if (device.device_family !== 'garagedoor') { continue; }
        if (!device.state) {
          console.warn('WEIRD: garagedoor does not have state. Device:', device);
          continue;
        }
        if (device.state.door_state !== 'closed') {
          if (!this.openDoors[device.serial_number]) {
            // not already known as open
            console.info('Garage door ', device.serial_number, ' is now open.');
            this.openDoors[device.serial_number] = { openAt: new Date() };
          }

          const openAgeMinutes = Math.round(((new Date()) - this.openDoors[device.serial_number].openAt) / 60 / 1000);
          console.info('Garage door ', device.serial_number, ' has been open for ', openAgeMinutes, ' minutes.');

          if (openAgeMinutes && (openAgeMinutes % (process.env.MYQ_MAX_OPEN_DURATION_MINUTES || 10) === 0)) {
            this.sendMessage(`Garage door has been open for ${openAgeMinutes} minutes.`);
          }
        } else {
          if (this.openDoors[device.serial_number]) {
            // now closed, so delete from the state object
            console.info('Garage door ', device.serial_number, ' is now closed.');
            delete this.openDoors[device.serial_number];
          }
        }
      }
    });
  }
};
