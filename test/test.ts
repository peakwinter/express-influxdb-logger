import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import express from 'express';
import Influx from 'influx';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import createInfluxDBLogger, { Options } from '../src/index';

chai.use(chaiHttp);
chai.use(sinonChai);

describe('Express InfluxDB Logger Tests', () => {
  let app: express.Express;
  let mockInfluxClient;

  beforeEach(() => {
    app = express();
    mockInfluxClient = sinon.createStubInstance(Influx.InfluxDB, {
      writePoints: Promise.resolve(),
    });
    const testConfig: Options = {
      protocol: 'http',
      host: 'test.dev',
      port: 9876,
      database: 'test',
      flushAfter: 0,
      client: mockInfluxClient,
    };

    const influxDBLogger = createInfluxDBLogger(testConfig);
    app.use(influxDBLogger);

    app.get('/', (req, res) => {
      res.status(200).send('');
    });
  });

  it('successfully logs a request', done => {
    chai.request(app)
      .get('/')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.text).to.equal('');

        expect(mockInfluxClient.writePoints).to.have.been.calledOnce; // eslint-disable-line
        done();
      });
  });
});
