import test from 'ava';
import { SessionData } from 'express-session';
import { harpee } from 'harpee';
import HarperDBStore from './index';
const {createConnection,Schema,Model,Utilities } = harpee;


const config = {
    host: 'https://hashnode-lv.harperdbcloud.com',
    username: 'veek',
    password: '@veek.247',
};
createConnection(config,(info)=>console.log({info})
);

const hdbStoreOptions = {
    config,schema:'sessionTestSchema',table:'sessions'
}
const sessionSchema = new Schema({
    name: hdbStoreOptions.schema, fields: {session:''}, silent: true, primaryKey: 'sid'
});
const sessionModel = new Model(hdbStoreOptions.table, sessionSchema);
const harpeeClient = {
    model:sessionModel,util:new Utilities()
}

test.before(async () => {
  console.log('before');
  
    await harpeeClient.model.init();
});

test.beforeEach(async () => {
  await harpeeClient.util.dropTable({

    schema: hdbStoreOptions.schema,
    table: hdbStoreOptions.table,
  });
  await harpeeClient.util.createTable({

    schema: hdbStoreOptions.schema,
    table: hdbStoreOptions.table,
    hashAttribute:'sid'
  });

  await harpeeClient.util.createAttribute({
   schema: hdbStoreOptions.schema,
    table: hdbStoreOptions.table,
    attribute:'session'
   
  });
  await harpeeClient.util.createAttribute({
    
   schema: hdbStoreOptions.schema,
    table: hdbStoreOptions.table,
    attribute:'expiration'
   
  });
});

test.after.always(async () => {
  await harpeeClient.util.dropSchema({
     schema: hdbStoreOptions.schema,

  });
});

test.serial('should store and retrieve session from HarperDB', async (t) => {
  const store = new HarperDBStore(hdbStoreOptions);
  const session = { cookie: { maxAge: 2000 }, name: 'John' } as unknown as SessionData;

  // Store session
  await new Promise<void>((resolve) =>
    store.set('123', session, (err) => {
      t.falsy(err);
      resolve();
    }),
  );

  // Retrieve session
  const retrievedSession = await new Promise<SessionData>((resolve) =>
    store.get('123', (err, retrievedSession) => {
      t.falsy(err);
      t.deepEqual(retrievedSession, session);
      resolve(retrievedSession as SessionData);
    }),
  );

  // Verify session expiration
  const expiration = Date.now() + 2000;
  const diff = Math.abs((Date.now() + (retrievedSession.cookie?.maxAge as number)) - expiration);
  t.true(diff < 1000); // Allow for up to 1 second of difference
});

test.serial('should delete session from HarperDB', async (t) => {
  const store = new HarperDBStore(hdbStoreOptions);
  const session = { cookie: { maxAge: 2000 }, name: 'John' } as unknown as SessionData;;

  // Store session
  await new Promise<void>((resolve) =>
    store.set('123', session, (err) => {
      t.falsy(err);
      resolve();
    }),
  );

  // Delete session
  await new Promise<void>((resolve) =>
    store.destroy('123', (err) => {
      t.falsy(err);
      resolve();
    }),
  );

  // Verify session deletion
  const retrievedSession = await new Promise<SessionData>((resolve) =>
    store.get('123', (err, retrievedSession) => {
      t.falsy(err);
      t.is(retrievedSession, undefined);
      resolve(retrievedSession as SessionData);
    }),
  );
});

test.serial('should auto-remove expired sessions', async (t) => {
  const store = new HarperDBStore({ ...hdbStoreOptions, autoRemove: true, autoRemoveInterval: 1 });
  const session = { cookie: { maxAge: 1000 }, name: 'John' } as unknown as SessionData;;

  // Store session
  await new Promise<void>((resolve) =>
    store.set('123', session, (err) => {
      t.falsy(err);
      resolve();
    }),
  );

  // Wait for session to expire
  await new Promise<void>((resolve) =>
    setTimeout(() => {
      t.pass('Session expired');
      resolve();
    }, 1500),
  );

  // Verify session auto-removal
  const retrievedSession = await new Promise<SessionData>((resolve) =>
    store.get('123', (err, retrievedSession) => {
      t.falsy(err);
      t.is(retrievedSession, undefined);
      resolve(retrievedSession as SessionData);
    }),
  );
});
