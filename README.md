# Connect-HarperDB

Connect-HarperDB is a package that provides a session store implementation for the [express-session](https://npmjs.com/package/express-session) middleware that uses HarperDB as the database.

## Installation
You can install Connect-HarperDB via npm using the following command:

```
 npm install connect-harperdb
```
## Usage
To use Connect-HarperDB as your session store in an Express.js application, simply pass an instance of HarperDBStore to the session middleware. Here's an example:

#### JavaScript
```js
const express = require('express');
const session = require('express-session');
const HarperDBStore = require('connect-harperdb');

const app = express();

// HarperDB authentication configuration
const config = {
  username: 'your_username',
  password: 'your_password',
  host: 'http://your_harperdb_instance_url'
};

// Session store configuration
const store = new HarperDBStore({
  config: config,
  schema: 'your_schema_name',
  table: 'your_table_name',
  ttl: 86400 // session time-to-live (in seconds)
});

app.use(session({
  secret: 'your_session_secret',
  resave: false,
  saveUninitialized: true,
  store: store // set the HarperDBStore as the session store
}));

```

#### Typescript
```ts
import express from 'express';
import session from 'express-session';
import HarperDBStore from 'connect-harperdb';

const app = express();

// HarperDB authentication configuration
const config = {
  username: 'your_username',
  password: 'your_password',
  host: 'http://your_harperdb_instance_url'
};

// Session store configuration
const store = new HarperDBStore({
  config: config,
  schema: 'your_schema_name',
  table: 'your_table_name',
  ttl: 86400 // session time-to-live (in seconds)
});

app.use(session({
  secret: 'your_session_secret',
  resave: false,
  saveUninitialized: true,
  store: store // set the HarperDBStore as the session store
}));


```

In the above examples, we create a HarperDBStore instance and pass it to the express-session middleware as the session store. We provide the HarperDB authentication configuration and the configuration for the session store.

Once the express-session middleware is initialized with the HarperDBStore instance, it automatically handles the session management and storage.
