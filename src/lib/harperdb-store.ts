import { promisify } from 'util';
import { Store } from 'express-session';
import { HarpeeModel } from 'harpee/types/core/harpee-model';

import { harpee, HType } from 'harpee';
const { createConnection, Schema, Model } = harpee;

export interface HarperDBAuth {
  /**
   * your HarperDB username
   */
  username: string;
  /**
   *  your HarperDB password
   */
  password: string;
  /**
   * your harperDB instance url
   */
  host: string;
}
interface HarpeeClientOptions {
  config: HarperDBAuth;
  schema?: string;
  table?: string;
}

export interface HarperDBStoreOptions {
  /**
   * Your HarperDB details
   */
  config: HarperDBAuth;
  /**
   * The name of the schema for the session, if not specified, a schema named `sessionSchema` is used
   */
  schema?: string;
  /**
   * The name of the table for the session, if not specified, a table named `sessions` is used
   */
  table?: string;
  ttl?: number;
  serialize?: (object: any) => Promise<string>;
  deserialize?: (str: string) => Promise<any>;
}

class HarperDBStore extends Store {
  private sessionModel: HarpeeModel;
  private ttl: number;
  private serialize: (object: any) => Promise<string>;
  private deserialize: (str: string) => Promise<any>;

  constructor(options: HarperDBStoreOptions) {
    super();

    const { model, init } = this.harpeeClient({
      config: options.config,
      schema: options.schema,
      table: options.table,
    });
    // initializes the model
    init();
    this.sessionModel = model;
    this.ttl = options.ttl || 86400;
    this.serialize = promisify(options.serialize || JSON.stringify);
    this.deserialize = promisify(options.deserialize || JSON.parse);
  }

  async get(sid: string, callback: (err?: any, session?: any) => void) {
    try {
      const { data: session } = await this.sessionModel.findOne<string>(
        {
          sid,
        },
        ['session']
      );

      if (session) {
        const data = await this.deserialize(session);
        callback(null, data);
      } else {
        callback();
      }
    } catch (error) {
      callback(error);
    }
  }

  async set(sid: string, session: any, callback: (err?: any) => void) {
    try {
      const _session = await this.serialize(session);
      const expires = new Date(Date.now() + this.ttl * 1000);

      await this.sessionModel.create({ sid, session: _session, expires });

      callback();
    } catch (error) {
      callback(error);
    }
  }

  async destroy(sid: string, callback: (err?: any) => void) {
    try {
      await this.sessionModel.findByIdAndRemove([sid]);

      callback();
    } catch (error) {
      callback(error);
    }
  }

  async touch(sid: string, session: any, callback: (err?: any) => void) {
    try {
      const expires = new Date(Date.now() + this.ttl * 1000);

      await this.sessionModel.update([{ sid, expires }]);

      callback();
    } catch (error) {
      callback(error);
    }
  }
  private harpeeClient({ config, schema, table }: HarpeeClientOptions) {
    createConnection(config);
    const sessionSchema = new Schema({
      name: schema ?? 'sessionSchema',
      fields: {
        session: HType.string().required(),
        expires: HType.date().required(),
      },
      silent: true,
      primaryKey: 'sid',
    });
    const sessionModel = new Model(table ?? 'sessions', sessionSchema);
    return {
      init: async () => await sessionModel.init(),
      model: sessionModel,
    };
  }
}

export default HarperDBStore;
