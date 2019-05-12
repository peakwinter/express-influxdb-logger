# express-influxdb-logger

express-influxdb-logger is an [Express middleware](https://expressjs.com/en/guide/using-middleware.html) that can be used to log info on all HTTP requests to an InfluxDB instance.

## Getting Started

```js
const express = require('express');
const createInfluxDBLogger = require('express-influxdb-logger');

const app = express();
app.use(createInfluxDBLogger({
  host: 'my-influxdb-server.host',
  port: 8086,
  database: 'database_name',
  username: 'influxdb_user',
  password: 'influxdb_password,
}));

// Then declare your route handlers below.
```

## Configuration

The following options are accepted when creating an instance of the InfluxDB logger:

* `host`: hostname of your InfluxDB server _(required)_
* `port`: port on which the InfluxDB's HTTP server listens on _(required)_
* `database`: name of the database to log to _(required)_
* `protocol`: either 'http' or 'https' _(required, default: `https`)_
* `username`: username to authenticate with if the server requires
* `password`: password to authenticate with if the server requires
* `flushAfter`: send log lines to the database in batches of this number _(default: 5)_
* `flushInterval`: send log lines to the database after this number of milliseconds max _(default: 10000)_

Note the `flushAfter` and `flushInterval` config values work together. By default, a batch will be sent to the server every time it has least 5 log entries in it, OR after 10 seconds of staleness at the longest.

## Credits

A TypeScript fork and extension of [influx-express](https://github.com/jackzampolin/influx-express).
