'use strict';

const MQ = require('@hjdhjd/myq').myQApi;

if (!process.env.MYQ_USER || !process.env.MYQ_PASS) {
  console.log('ERROR: Env vars MYQ_USER and/or MYQ_PASS are not defined!');
  process.exit(1);
}

const openDoors = {};

const myQ = new MQ(process.env.MYQ_USER, process.env.MYQ_PASS);

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
            console.error('THIS IS A PROBLEM!');
          } else {
            console.error('Not yet a problem.');
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

// interval run
setInterval(() => {
  refreshState(myQ);
}, (process.env.MYQ_POLLING_INTERVAL_MINUTES || 1) * 60 * 1000);
