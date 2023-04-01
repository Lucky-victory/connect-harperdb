import test from 'ava';
import { SessionData } from 'express-session';
import { promisify } from 'util';
import HarperDBStore from '../index';
import { harpeeClient, hdbStoreOptions, storeCreator } from './helper';


test.before(async () => {
  
  await harpeeClient.util.createSchema({
    schema: hdbStoreOptions.schema,

  });
    await harpeeClient.util.createTable({
    schema: hdbStoreOptions.schema,
      table: hdbStoreOptions.table,
    hashAttribute:'sid'
  });
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

});

test.after.always(async () => {
  
  await harpeeClient.util.dropSchema({
     schema: hdbStoreOptions.schema,

  });
});

test.serial('should store and retrieve session from HarperDB', async (t) => {
  const { asyncStore  } = storeCreator();
  const session = { cookie: { maxAge: 2000 }, name: 'John' } as unknown as SessionData;

  // Store session
  await  asyncStore.set('123', session);

  // Retrieve session
  const retrievedSession = await asyncStore. get('123') as SessionData;
    t.deepEqual(retrievedSession, session);

  // Verify session expiration
  const expiration = Date.now() + 2000;
  const diff = Math.abs((Date.now() + (retrievedSession.cookie?.maxAge as number)) - expiration);
  t.true(diff < 1000); // Allow for up to 1 second of difference
});

test.serial('should delete session from HarperDB', async (t) => {
  
  const { asyncStore  } = storeCreator();
  const session = { cookie: { maxAge: 2000 }, name: 'John' } as unknown as SessionData;;

  // Store session
  await asyncStore.set('123', session);

  // Delete session
  await asyncStore.destroy('123');

  // Verify session deletion
  const retrievedSession = await  asyncStore.get('123')
  t.is(retrievedSession, undefined);

});

test.serial('should return all sessions from HarperDB', async (t) => {
  const { asyncStore  } = storeCreator();
  const session = { cookie: { maxAge: 1000 }, name: 'John' } as unknown as SessionData;;

  // Store session

  await asyncStore.set('123', session);
  
   const retrievedSessions= await asyncStore.all()
    
      t.deepEqual([session],retrievedSessions)
    
  

})

test.serial('should return the total length of sessions from HarperDB',async (t)=>{

  const store = new HarperDBStore({ ...hdbStoreOptions });
  const session = { cookie: { maxAge: 1000 }, name: 'John' } as unknown as SessionData;;

  // Store session
  await new Promise<void>((resolve) =>
    store.set('123', session, (err) => {
      t.falsy(err);
      resolve();
    }),
  );

   await new Promise<number>((resolve, reject) => {
    store.length((err, length) => {
      t.falsy(err);
      t.is(length, 1);
      resolve(length as number)
    })
  })
})