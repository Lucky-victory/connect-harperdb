//@ts-nocheck
import test from 'ava';
import express from 'express';
import session,{ SessionOptions } from 'express-session';
import HarperDBStore,{ HarperDBStoreOptions } from '../lib/harperdb-store';
import request from 'supertest';
import dotenv from 'dotenv';
dotenv.config()


function createSupertestAgent(
  sessionOpts: SessionOptions,
  hdbStoreOpts: HarperDBStoreOptions
) {
  const app = express()
  const store = new HarperDBStore(hdbStoreOpts)
  app.use(
    session({
      ...sessionOpts,saveUninitialized:false,resave:false,
      store: store,
    })
  )
  app.get('/', function (req, res) {
    if (typeof req.session.views === 'number') {
      req.session.views++
    } else {
      req.session.views = 0
    }
    res.status(200).send({ views: req.session.views })
  })
  app.get('/ping', function (req, res) {
    res.status(200).send({ views: req.session.views })
  })
  const agent = request.agent(app)
  return agent
}

function createSupertetAgentWithDefault(
  sessionOpts: Omit<SessionOptions, 'secret'> = {},
  hdbStoreOpts: HarperDBStoreOptions={config:{username:process.env.DB_USER as string,host:process.env.DB_HOST as string,password:process.env.DB_PASS as string}}
) {
  return createSupertestAgent(
    { secret: 'foo', ...sessionOpts },
    {
        ...hdbStoreOpts,
      config:{username:process.env.DB_USER as string,host:process.env.DB_HOST as string,password:process.env.DB_PASS as string}
    }
  )
}

test.serial('simple case', (t) => {
  const agent = createSupertetAgentWithDefault()
  agent
    .get('/')
    .expect(200)
    .then((response) => response.headers['set-cookie'])
    .then((cookie) => {
      agent
        .get('/')
        .expect(200)
        .end((err, res) => {
          t.is(err, null)
          t.deepEqual(res.body, { views: 1 })
      
        })
    })
})
