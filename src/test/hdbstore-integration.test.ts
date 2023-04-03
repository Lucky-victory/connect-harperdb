//@ts-nocheck
import test from 'ava';
import express from 'express';
import session, { SessionOptions } from 'express-session';
import HarperDBStore, { HarperDBStoreOptions } from '../lib/harperdb-store';
import request from 'supertest';
import dotenv from 'dotenv';
dotenv.config();

function createSupertestAgent(
  sessionOpts: SessionOptions,
  hdbStoreOpts: HarperDBStoreOptions
) {
  const app = express();
  const store = new HarperDBStore(hdbStoreOpts);
  app.use(
    session({
      ...sessionOpts,
      saveUninitialized: false,
      resave: false,
      store: store,
    })
  );
  app.get('/', function (req, res) {
    if (typeof req.session.views === 'number') {
      req.session.views++;
    } else {
      req.session.views = 0;
    }
    res.status(200).send({ views: req.session.views });
  });

  const agent = request.agent(app);
  return agent;
}

function createSupertetAgentWithDefault(
  sessionOpts: Omit<SessionOptions, 'secret'> = {},
  hdbStoreOpts: HarperDBStoreOptions = {
    config: {
      username: process.env.DB_USER as string,
      host: process.env.DB_HOST as string,
      password: process.env.DB_PASS as string,
    },
  }
) {
  return createSupertestAgent(
    { secret: 'secret', key: 'user.sid', ...sessionOpts },
    {
      ...hdbStoreOpts,
    }
  );
}
test.serial('simple case', async (t) => {
  const agent = createSupertetAgentWithDefault();
  const response = await agent.get('/').expect(200);
  const cookie = response.headers['set-cookie'];

  const res = await agent.get('/').expect(200);
  t.is(res.body.views, 1);
});
