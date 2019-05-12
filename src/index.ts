import * as https from 'https';
import * as events from 'events';
import * as Influx from 'influx';
import { Request, Response, NextFunction } from 'express'; // eslint-disable-line import/no-unresolved,import/no-extraneous-dependencies


type HTTPVerb = 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE';

export interface Options {
  protocol?: 'https' | 'http';
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;

  measurement?: string;
  appname?: string;
  facility?: string;

  flushAfter?: number;
  flushInterval?: number;

  client?: Influx.InfluxDB;

  requestOptions?: https.RequestOptions;
}

export interface RequestLogPoint extends Influx.IPoint {
  measurement: string;
  tags: {
    appname: string;
    facility: string;
    host: string;
    hostname: string;
    severity: string;
  };
  fields: {
    timestamp: number;
    method: HTTPVerb;
    path: string;
    status: number;
    responseTime: number;
  };
}

type RequestWithStart = Request & { start: number }

class InfluxDBLoggerError extends Error {}

class LoggingEventEmitter extends events.EventEmitter {
  public age: number = 0;

  public points: RequestLogPoint[] = [];

  public flushInterval: number = 0;
}

const defaultOptions: Partial<Options> = {
  protocol: 'https',
  flushAfter: 5,
  flushInterval: 10000,
  measurement: 'syslog',
  appname: 'express',
  facility: 'local0',
};

function validateOptions(options: Options) {
  if (!options.protocol || !(options.protocol === 'http' || options.protocol === 'https')) {
    throw new InfluxDBLoggerError('Connection protocol missing or invalid');
  }
  if (!options.host || typeof options.host !== 'string') {
    throw new InfluxDBLoggerError('Host missing or invalid');
  }
  if (!options.port || typeof options.port !== 'number' || options.port < 1 || options.port > 65535) {
    throw new InfluxDBLoggerError('Port missing or invalid');
  }
  if (!options.database || typeof options.database !== 'string') {
    throw new InfluxDBLoggerError('Database name missing or invalid');
  }
}


export default function createInfluxDBLogger(options: Options) {
  const loggerOptions = { ...defaultOptions, ...options };
  validateOptions(loggerOptions);

  let client: Influx.InfluxDB;
  if (loggerOptions.client) {
    client = loggerOptions.client;
  } else {
    client = new Influx.InfluxDB({
      protocol: loggerOptions.protocol,
      host: loggerOptions.host,
      port: loggerOptions.port,
      database: loggerOptions.database,
      username: loggerOptions.username,
      password: loggerOptions.password,
      options: loggerOptions.requestOptions || {},
    } as Influx.ISingleHostConfig);
  }
  const batch = new LoggingEventEmitter();

  function setFlushInterval() {
    if (batch.flushInterval) {
      clearInterval(batch.flushInterval);
    }
    batch.flushInterval = setInterval(() => {
      batch.emit('flush');
      setFlushInterval();
    }, loggerOptions.flushInterval);
  }

  function flushPoints(this: LoggingEventEmitter) {
    if (this.points) {
      client.writePoints(this.points).catch(error => {
        console.log(error.message); // eslint-disable-line no-console
      });

      this.points = [];
    }
  }

  function onAddPoint(this: LoggingEventEmitter) {
    if (!loggerOptions.flushAfter || this.points.length >= loggerOptions.flushAfter) {
      batch.emit('flush');
    }

    if (loggerOptions.flushInterval) {
      setFlushInterval();
    }
  }

  if (loggerOptions.flushInterval) {
    setFlushInterval();
  }
  batch.on('addPoint', onAddPoint);
  batch.on('flush', flushPoints);

  return function influxDBMiddleware(req: RequestWithStart, res: Response, next: NextFunction) {
    req.start = Date.now();

    function makePoint() {
      const eventTime = Date.now();
      const responseTime = eventTime - req.start;

      batch.points.push({
        measurement: loggerOptions.measurement,
        tags: {
          appname: loggerOptions.appname,
          facility: loggerOptions.facility,
          host: req.host,
          hostname: req.hostname,
          severity: 'info',
        },
        fields: {
          timestamp: eventTime,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          responseTime,
        },
        timestamp: eventTime,
      } as RequestLogPoint);

      batch.emit('addPoint');
    }

    function cleanupListeners() {
      res.removeListener('finish', makePoint);
      res.removeListener('error', cleanupListeners);
      res.removeListener('close', cleanupListeners);
    }

    res.once('finish', makePoint);
    res.once('error', cleanupListeners);
    res.once('close', cleanupListeners);

    if (next) {
      next();
    }
  };
}
