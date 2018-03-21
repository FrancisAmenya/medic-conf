const memdown = require('memdown');
const memPouch = require('pouchdb').defaults({ db:memdown });
const express = require('express');
const expressPouch = require('express-pouchdb');
const ExpressSpy = require('./express-spy');
const bodyParser = require('body-parser');

const mockMiddleware = new ExpressSpy();

const opts = {
  inMemoryConfig: true,
  logPath: 'express-pouchdb.log',
  mode: 'fullCouchDB',
};
const app = express();
app.use(bodyParser.json());
app.all('/api/*', mockMiddleware.requestHandler);
app.use('/', stripAuth, expressPouch(memPouch, opts));

let server;

module.exports = {
  db: new memPouch('medic'),
  giveResponses: mockMiddleware.setResponses,
  requestLog: () => mockMiddleware.requests.map(r => ({ method:r.method, url:r.originalUrl, body:r.body })),
  start: () => {
    if(server) throw new Error('Server already started.');
    server = app.listen();

    const port = server.address().port;
    module.exports.couchUrl = `http://admin:pass@localhost:${port}/medic`;
  },
  stop: () => {
    server.close();
    server = null;
    delete module.exports.couchUrl;
    mockMiddleware.reset();
  },
};

/**
 * Strip basic auth header because right now
 * 1. we don't need to test it; and
 * 2. I don't know how to configure it in pouchdb-server/pouchdb-express
 */
function stripAuth(req, res, next) {
  delete req.headers.authorization;
  next();
}
