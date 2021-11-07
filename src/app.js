'use strict';

// populate environment
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

// set up Twilio
const accountSid = process.env.TWILIO_ACC_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);

// set up myQ
const MQ = require('@hjdhjd/myq').myQApi;
const myQ = new MQ(process.env.MYQ_USER, process.env.MYQ_PASS);

// helper function to dispatch a message
const sendMessage = (body) => {
  twilio.messages
    .create({
      body: body,
      messagingServiceSid: process.env.TWILIO_MSG_SVC_SID,
      to: process.env.TWILIO_TO
    })
    .then(message => console.log(`Sent SMS <${message.sid}> :: ${body}`))
    .done();
};

// to keep track of when doors were first noticed being open
const openDoors = {};

// main loop
const refreshState = (myQ) => {
  myQ.refreshDevices().then(() => {
    for (const device of myQ.devices) {
      // console.debug(device);
      if (device.device_family !== 'garagedoor') { continue; }
      if (!device.state) {
        console.warn('WEIRD: garagedoor does not have state. Device:', device);
        continue;
      }
      if (device.state.door_state !== 'closed') {
        if (!openDoors[device.serial_number]) {
          // not already known as open
          console.info('Garage door ', device.serial_number, ' is now open.');
          openDoors[device.serial_number] = { openAt: new Date() };
        }

        const openAgeMinutes = Math.round(((new Date()) - openDoors[device.serial_number].openAt) / 60 / 1000);
        console.info('Garage door ', device.serial_number, ' has been open for ', openAgeMinutes, ' minutes.');
        if (openAgeMinutes && (openAgeMinutes % (process.env.MYQ_MAX_OPEN_DURATION_MINUTES || 10) === 0)) {
          sendMessage(`Garage door has been open for ${openAgeMinutes} minutes.`);
        }
      } else {
        if (openDoors[device.serial_number]) {
          // now closed, so delete from the state object
          console.info('Garage door ', device.serial_number, ' is now closed.');
          delete openDoors[device.serial_number];
        }
      }
    }
  });
};

// hello to you too
sendMessage('Starting up.');

// initial run
refreshState(myQ);

// interval run
setInterval(() => {
  refreshState(myQ);
}, (process.env.MYQ_POLLING_INTERVAL_MINUTES || 1) * 60 * 1000);
