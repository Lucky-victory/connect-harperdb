import { harpee } from 'harpee';
import { promisify } from 'util';
import HarperDBStore, { HarperDBStoreOptions } from '../lib/harperdb-store';
import dotenv from 'dotenv';
dotenv.config();
const { createConnection, Schema, Model, Utilities } = harpee;

const config = {
  host: process.env.DB_HOST || 'http://localhost:9925',
  username: process.env.DB_USER || 'HBD_ADMIN',
  password: process.env.DB_PASS || 'HBD_PASSWORD',
};

export const hdbStoreOptions = {
  config,
  schema: 'sessionTestSchema',
  table: 'sessions',
};
createConnection(config);
const sessionSchema = new Schema({
  name: hdbStoreOptions.schema,
  fields: {},
  silent: true,
  primaryKey: 'sid',
});
const sessionModel = new Model(hdbStoreOptions.table, sessionSchema);
export const harpeeClient = {
  model: sessionModel,
  util: new Utilities(),
};

export const storeCreator = (options: Partial<HarperDBStoreOptions> = {}) => {
  const store = new HarperDBStore({
    ...hdbStoreOptions,
    ...options,
  });

  const asyncStore = {
    length: promisify(store.length).bind(store),
    clear: promisify(store.clear).bind(store),
    get: promisify(store.get).bind(store),
    set: promisify(store.set).bind(store),
    all: promisify(store.all).bind(store),
    touch: promisify(store.touch).bind(store),
    destroy: promisify(store.destroy).bind(store),
  };
  return { store, asyncStore };
};
