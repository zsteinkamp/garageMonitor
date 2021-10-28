'use strict';

const MQ = require('@hjdhjd/myq').myQApi;

if (!process.env.MYQ_USER || !process.env.MYQ_PASS) {
  console.log('ERROR: Env vars MYQ_USER and/or MYQ_PASS are not defined!');
  process.exit(1);
}

const myQ = new MQ(process.env.MYQ_USER, process.env.MYQ_PASS);
myQ.refreshDevices().then(() => {
  console.log(myQ.devices);
});
