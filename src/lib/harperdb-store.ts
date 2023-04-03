import { promisify } from 'util';
import { Store, SessionData } from 'express-session';
import { HarpeeModel } from 'harpee/types/core/harpee-model';
import Debug from 'debug';
import { harpee, HType } from 'harpee';
const { createConnection, Schema, Model, Sqler } = harpee;

const debug = Debug('connect-harperdb');

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
  serialize?: (object: any) => string;
  autoRemove?: boolean;
  autoRemoveInterval?: number;
}
interface HarperDBSession {
  sid: string;
  session: SessionData;
  expiration: number;
}
class HarperDBStore extends Store {
  private sessionModel: HarpeeModel;
  private ttl: number;
  private serialize: (sess: SessionData) => string;
  private schema: string;
  private table: string;
  constructor(options: HarperDBStoreOptions) {
    super();
    this.schema = options.schema ?? 'sessionSchema';
    this.table = options.table ?? 'sessions';
    const { model, init } = this.harpeeClient({
      config: options.config,
      schema: this.schema,
      table: this.table,
    });
    // initializes the model
    init();
    this.sessionModel = model;
    this.ttl = options.ttl || 1209600;
    this.serialize = options.serialize || JSON.stringify;
  }

  get(
    sid: string,
    callback: (err?: any, session?: SessionData | null) => void
  ) {
    (async () => {
      try {
        debug(`HarperDBStore#get=${sid}`);
        let { data: result } = await this.sessionModel.findOne<HarperDBSession>(
          {
            sid,
          },
          ['session', 'expiration']
        );

        if (!result) {
          return callback(null);
        }

        const sessionData = result.session;
        this.emit('get', sid);
        return callback(null, sessionData);
      } catch (error) {
        return callback(error);
      }
    })();
  }

  set(sid: string, session: SessionData, callback: (err?: any) => void) {
    (async () => {
      try {
        debug(`HarperDBStore#set=${sid}`);
        const _session = await this.serialize(session);
        const expiration =
          Date.now() + (session.cookie?.maxAge || this.ttl * 1000);

        await this.sessionModel.create({ sid, session: _session, expiration });

        this.emit('set', sid);
      } catch (error) {
        return callback(error);
      }
      return callback(null);
    })();
  }
  destroy(sid: string, callback: (err?: any) => void) {
    (async () => {
      try {
        debug(`HarperDBStore#destroy()`);
        await this.sessionModel.findByIdAndRemove([sid]);
        this.emit('destroy', sid);
        return callback(null);
      } catch (error) {
        return callback(error);
      }
    })();
  }

  length(callback: (err: any, length?: number | undefined) => void): void {
    (async () => {
      try {
        debug(`HarperDBStore#length()`);
        const { schema, table } = this;
        const queryBuilder = new Sqler();
        const { query } = queryBuilder
          .selectCount('sid')
          .as('total_session')
          .from(schema, table);

        const { data } = await this.sessionModel.query<
          { total_session: number }[]
        >(query);
        const { total_session } = (data as { total_session: number }[])[0];

        return callback(null, total_session);
      } catch (error) {
        return callback(error);
      }
    })();
  }
  all(
    callback: (
      err: any,
      obj?: SessionData[] | { [sid: string]: SessionData } | null | undefined
    ) => void
  ): void {
    (async () => {
      try {
        debug(`HarperDBStore#all()`);
        const { data: result } = await this.sessionModel.find<
          HarperDBSession[]
        >({ getAttributes: ['sid', 'expiration', 'session'] });
        const sessions = result?.map((item) => item.session);

        this.emit('all', sessions);
        return callback(null, sessions);
      } catch (error) {
        return callback(error);
      }
    })();
  }
  clear(callback?: (err?: any) => void): void {
    (async () => {
      try {
        debug(`HarperDBStore#clear()`);
        await this.sessionModel.clearAll();

        return callback && callback();
      } catch (error) {
        return callback && callback(error);
      }
    })();
  }
  touch(
    sid: string,
    session: SessionData,
    callback: (err?: any) => void
  ): void {
    (async () => {
      try {
        debug(`HarperDBStore#touch=${sid}`);
        const expiration =
          Date.now() + (session.cookie?.maxAge || this.ttl * 1000);

        const { data } = await this.sessionModel.update([{ sid, expiration }]);
        if (data?.update_hashes.length === 0) {
          return callback(new Error('Unable to find the session to touch'));
        }
        this.emit('touch', sid, session);
        return callback(null);
      } catch (error) {
        return callback(error);
      }
    })();
  }
  private harpeeClient({ config, schema, table }: HarpeeClientOptions) {
    createConnection(config);
    const sessionSchema = new Schema({
      name: schema,
      fields: {
        session: HType.string(),
        expiration: HType.date(),
      },
      silent: true,
      primaryKey: 'sid',
    });
    const sessionModel = new Model(table as string, sessionSchema);
    const init = async () => {
      await sessionModel.init();
    };
    return {
      init: async () => await init(),
      model: sessionModel,
    };
  }
}

export default HarperDBStore;
