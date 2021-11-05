'use strict';

const MQ = require('@hjdhjd/myq').myQApi;
const nodemailer = require('nodemailer');

for (const reqEnv of [
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_HOST',
  'SMTP_FROM',
  'SMTP_TO',
  'MYQ_USER',
  'MYQ_PASS'
]) {
  if (!process.env[reqEnv]) {
    console.log(`ERROR: Env var ${reqEnv} is not defined.`);
    process.exit(1);
  }
}

const openDoors = {};

const myQ = new MQ(process.env.MYQ_USER, process.env.MYQ_PASS);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER, // generated ethereal user
    pass: process.env.SMTP_PASS // generated ethereal password
  }
});

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
        } else {
          // known as open already
          const openAgeMinutes = Math.round(((new Date()) - openDoors[device.serial_number].openAt) / 60 / 1000);
          console.info('Garage door ', device.serial_number, ' has been open for ', openAgeMinutes, ' minutes.');
          if (openAgeMinutes > (process.env.MYQ_MAX_OPEN_DURATION_MINUTES || 10)) {
            transporter.sendMail({
              from: process.env.SMTP_FROM,
              to: process.env.SMTP_TO,
              subject: 'Garage Alert',
              text: 'Door is open'
            }).then((info) => {
              console.log('Email sent: %s', info.messageId);
            });
          }
        }
      } else {
        if (openDoors[device.serial_number]) {
          // now closed, so delete from the state object
          console.info('Garage door ', device.serial_number, ' is now closed.');
          delete openDoors[device.serial_number];
        }
      }
    }
    console.log(openDoors);
  });
};

// initial run
refreshState(myQ);

transporter.sendMail({
  from: process.env.SMTP_FROM,
  to: process.env.SMTP_TO,
  subject: 'Garage Alert',
  text: 'Starting Up'
}).then((info) => {
  console.log('Email sent: %s', info.messageId);
});

// interval run
setInterval(() => {
  refreshState(myQ);
}, (process.env.MYQ_POLLING_INTERVAL_MINUTES || 1) * 60 * 1000);
