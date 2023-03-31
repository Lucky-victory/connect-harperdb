import { promisify } from 'util';
import { Store,SessionData } from 'express-session';
import { HarpeeModel } from 'harpee/types/core/harpee-model';

import { harpee, HType } from 'harpee';
const { createConnection, Schema, Model,Sqler } = harpee;

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
  autoRemove?: boolean;
  autoRemoveInterval?: number;
}
interface HarperDBSession {
  sid: string;
  session: string;
  expiration: number;
}
class HarperDBStore extends Store {
  private sessionModel: HarpeeModel;
  private ttl: number;
  private serialize: (object: any) => Promise<string>;
  private deserialize: (str: string) => Promise<SessionData>;
  private autoRemove: boolean
  private autoRemoveInterval: number;
  private timer!: NodeJS.Timeout;
  private schema: string;
  private table: string;
  constructor(options: HarperDBStoreOptions) {
    super();
this.schema=options.schema??'sessionSchema'
this.table=options.table??'sessions'
    const { model, init } = this.harpeeClient({
      config: options.config,
      schema: this.schema,
      table: this.table,
    });
    // initializes the model
    init();
    this.sessionModel = model;
    this.ttl = options.ttl || 1209600;
    this.serialize = promisify(options.serialize || JSON.stringify);
    this.deserialize = promisify(options.deserialize || JSON.parse);
    this.autoRemoveInterval = options.autoRemoveInterval ?? 10;
    this.autoRemove = options.autoRemove ?? true;
    if (this.autoRemove) {
      
      this.timer = setInterval(this.autoRemoveSessions.bind(this), this.autoRemoveInterval * 60 * 1000);
    }
  }

  async get(sid: string, callback: (err?: any, session?: SessionData | null) => void) {
    try {
      let { data:result }  = await this.sessionModel.findOne<HarperDBSession>(
        {
          sid,
        },
        ['session','expiration']
      );
    console.log({result});
    
      if (result) {
        
        const sessionData = result.session as unknown as SessionData;
 const expiration = result.expiration;
        const remainingTime = expiration - Date.now();
        const maxAge = sessionData?.cookie?.maxAge;
         if (maxAge) {
          this.ttl = maxAge / 1000;
        }
        if (remainingTime > 0) {
          this.emit('get', sid);
          callback(null, sessionData);
        } else {
          await this.destroy(sid, callback);
        }
    
      } else {
        callback();
      }
    } catch (error) {
      console.log('get error:',error);

      callback(error);
    }
  }

  async set(sid: string, session: SessionData, callback: (err?: any) => void) {
    try {
      const _session = await this.serialize(session);
      const expiration =Date.now() + (session.cookie?.maxAge || this.ttl * 1000);

      await this.sessionModel.create({ sid, session: _session,  expiration });
this.emit('set',sid);
      callback(null);
    } catch (error) {
      console.log('set error:',error);

      callback(error);
    }
  }

  async destroy(sid: string, callback: (err?: any) => void) {
    try {
      await this.sessionModel.findByIdAndRemove([sid]);
      this.emit('destroy',sid);
      callback(null);
    } catch (error) {
      console.log('destroy error:',error);
      
      callback(error);
    }
  }

  async length(callback: (err: any, length?: number | undefined) => void): Promise<void> {
    try {
         const {schema, table }=this;
      const queryBuilder = new Sqler();
       const { query } = queryBuilder.selectCount('sid').as('total_session').from(schema, table);
      
      const { data } = await this.sessionModel.query<{total_session:number}[]>(query);
      const { total_session } = (data as { total_session: number }[])[0];
    
      callback(null, total_session);
      
    } catch (error) {
      callback(error)
    }
  }
  async all(callback: (err: any, obj?: SessionData[] | { [sid: string]: SessionData; } | null | undefined) => void): Promise<void> {
    try {
      const { data:result }=await this.sessionModel.find<HarperDBSession[]>({getAttributes:['sid','expiration','session']})
      const sessions = result?.map((item) => item.session) as unknown as SessionData[];
      this.emit('all', sessions);
      callback(null, sessions);
    } catch (error) {
      callback(error)
    }
  }
async clear(callback?: (err?: any) => void): Promise<void> {
  try {
    await this.sessionModel.clearAll();
   
   return callback && callback(null)

  } catch (error) {
 return   callback && callback(error)
  }
}
  async touch(sid: string, session: SessionData, callback: (err?: any) => void) {
    try {
      const expiration = Date.now() + (session.cookie?.maxAge || this.ttl * 1000);

      const { data } = await this.sessionModel.update([{ sid, expiration }]);
      if (data?.update_hashes.length === 0) {
      return  callback(new Error('Unable to find the session to touch'));
      }
      this.emit('touch', sid,session);
     return callback(null);
    } catch (error) {
      callback(error);
    }
  }
  private harpeeClient({ config, schema, table }: HarpeeClientOptions) {
    createConnection(config);
    const sessionSchema = new Schema({
      name: schema,
      fields: {
        session: HType.string().required(),
        expiration: HType.date().required(),
      },
      silent: true,
      primaryKey: 'sid',
    });
    const sessionModel = new Model(table as string, sessionSchema);
    return {
      init: async () => await sessionModel.init(),
      model: sessionModel,
    };
  }
  async autoRemoveSessions() {
    try {
      const currentTime = Date.now();
      const {schema, table }=this;
      const queryBuilder = new Sqler();
      const { query } = queryBuilder.delete().from(schema, table).where(`expiration <=${currentTime}`);
      console.log({query});
      
      await this.sessionModel.query(query);
      this.timer.unref();
  } catch (error) {
    console.error(`Error removing expired sessions: ${error}`);
  }
}

}

export default HarperDBStore;
