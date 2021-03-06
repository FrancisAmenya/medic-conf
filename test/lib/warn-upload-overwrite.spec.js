const sinon = require('sinon');
const rewire = require('rewire');
const { assert, expect } = require('chai');

const environment = require('../../src/lib/environment');
const api = require('../api-stub');
const fs = require('../../src/lib/sync-fs');
const readline = require('readline-sync');
const warnUploadOverwrite = rewire('../../src/lib/warn-upload-overwrite');
const log = require('../../src/lib/log');

let calls;

describe('warn-upload-overwrite', () => {

  beforeEach(() => {
    calls = [];
    log.info = (...args) => {
      calls.push(args);
    };
    sinon.stub(fs, 'exists').returns(true);
    api.start();
  });

  afterEach(() => {
    sinon.restore();
    api.stop();
  });

  describe('getStoredHash', () => {

    it('handles missing dir', () => {
      fs.exists
        .onCall(0).returns(false)
        .onCall(1).returns(false);
      sinon.stub(fs, 'mkdir').returns();
      sinon.stub(environment, 'apiUrl').get(() => 'http://a.com');
      const actual = warnUploadOverwrite.__get__('getStoredHash')('someid');
      expect(fs.mkdir.callCount).to.equal(1);
      expect(actual).to.equal(undefined);
    });

    it('handles missing file', () => {
      fs.exists
        .onCall(0).returns(true)
        .onCall(1).returns(false);
      sinon.stub(environment, 'apiUrl').get(() => 'http://a.com');
      const actual = warnUploadOverwrite.__get__('getStoredHash')('someid');
      expect(actual).to.equal(undefined);
    });

    it('handles JSON parsing exception', () => {
      sinon.stub(fs, 'read').returns('{');
      sinon.stub(environment, 'apiUrl').get(() => 'http://a.com');
      const actual = warnUploadOverwrite.__get__('getStoredHash')('someid');
      expect(actual).to.equal(undefined);
    });

    it('handles missing snapshot id', () => {
      const given = { id1: { 'a.com/medic': 'abc' } };
      sinon.stub(fs, 'read').returns(JSON.stringify(given));
      sinon.stub(environment, 'apiUrl').get(() => 'http://a.com');
      const actual = warnUploadOverwrite.__get__('getStoredHash')('id2');
      expect(actual).to.equal(undefined);
    });

    it('handles missing environment key', () => {
      const given = { id1: { 'a.com/medic': 'abc' } };
      sinon.stub(fs, 'read').returns(JSON.stringify(given));
      sinon.stub(environment, 'apiUrl').get(() => 'http://b.com');
      const actual = warnUploadOverwrite.__get__('getStoredHash')('id1');
      expect(actual).to.equal(undefined);
    });

    it('returns matching snapshot with default db name', () => {
      const given = { id1: { 'a.com/medic': 'abc' } };
      sinon.stub(fs, 'read').returns(JSON.stringify(given));
      sinon.stub(environment, 'apiUrl').get(() => 'http://a.com');
      const actual = warnUploadOverwrite.__get__('getStoredHash')('id1');
      expect(actual).to.equal('abc');
    });

    it('returns matching snapshot with specified db name for remote domain', () => {
      const given = {
        id1: {
          'a.com/medic': 'zzz',
          'a.com/not-medic': 'abc'
        },
        id2: {
          'a.com/not-medic': 'zzz'
        }
      };
      sinon.stub(fs, 'read').returns(JSON.stringify(given));
      sinon.stub(environment, 'apiUrl').get(() => 'http://a.com/not-medic');
      const actual = warnUploadOverwrite.__get__('getStoredHash')('id1');
      expect(fs.read.callCount).to.equal(1);
      expect(fs.read.args[0][0]).to.equal('.snapshots/remote.json');
      expect(actual).to.equal('abc');
    });

    it('returns matching snapshot with specified db name for localhost', () => {
      const given = { id1: { 'localhost/medic': 'abc' } };
      sinon.stub(fs, 'read').returns(JSON.stringify(given));
      sinon.stub(environment, 'apiUrl').get(() => 'http://admin:pass@localhost:35423/medic');
      const actual = warnUploadOverwrite.__get__('getStoredHash')('id1');
      expect(fs.read.callCount).to.equal(1);
      expect(fs.read.args[0][0]).to.equal('.snapshots/local.json');
      expect(actual).to.equal('abc');
    });

  });

  describe('prompts when attempting to overwrite docs', () => {

    it('shows diff when local is different from remote and the user requests a diff', () => {
      sinon.stub(readline, 'keyInYN').returns(true);
      sinon.stub(readline, 'keyInSelect').returns(2);
      sinon.stub(api.db, 'get').resolves({ _id: 'a', _rev: 'x', value: 1 });
      sinon.stub(fs, 'read').returns(JSON.stringify({ a: { 'localhost/medic': 'y' }}));
      const localDoc = { _id: 'a', value: 2 };
      return warnUploadOverwrite.preUploadDoc(api.db, localDoc).then(() => {
        assert.equal(calls.length, 1);
        assert.equal(calls[0][0], ' {\n\u001b[31m-  _rev: "x"\u001b[39m\n\u001b[31m-  value: 1\u001b[39m\n\u001b[32m+  value: 2\u001b[39m\n }\n');
      });
    });

    it('aborts when local is different from remote and the user requests an abort', () => {
      sinon.stub(readline, 'keyInYN').returns(true);
      sinon.stub(readline, 'keyInSelect').returns(3);
      sinon.stub(api.db, 'get').resolves({ _rev: 'x' });
      sinon.stub(fs, 'read').returns(JSON.stringify({ a: { 'localhost/medic': 'y' }}));
      const localDoc = { _id: 'a', _rev: 'y' };
      return warnUploadOverwrite.preUploadDoc(api.db, localDoc).catch(e => {
        assert.equal('configuration modified', e.message);
      });
    });

    it('removes username and password from couchUrl before writing', () => {
      const write = sinon.stub(fs, 'write').returns();
      sinon.stub(fs, 'read').returns(JSON.stringify({ a: { 'y/m': 'a-12' }}));
      const localDoc = { _id: 'a' };
      warnUploadOverwrite.postUploadDoc(localDoc);
      assert.equal(write.callCount, 1);
      assert.deepEqual(
        JSON.parse(write.args[0][1]),
        { a: { 'y/m': 'a-12', 'localhost/medic': 'E/lFVU12AAqbmWbH9LLbtA==' } }
      );
    });
  });

  describe('prompts when attempting to overwrite forms', () => {

    it('shows diff when local xml is different from remote xml and the user requests a diff', () => {
      sinon.stub(readline, 'keyInYN').returns(true);
      sinon.stub(readline, 'keyInSelect').returns(2);
      sinon.stub(api.db, 'get').resolves({ _rev: 'x', _attachments: { xml: { digest: 'abc' } } });
      sinon.stub(api.db, 'getAttachment').resolves(Buffer.from('<?xml version="1.0"?><y />', 'utf8'));
      sinon.stub(fs, 'read').returns('{"x":{"localhost/medic":"y"}}');
      const localXml = '<?xml version="1.0"?><x />';
      const localDoc = { _id: 'x' };
      return warnUploadOverwrite.preUploadForm(api.db, localDoc, localXml, []).then(() => {
        assert.equal(calls.length, 1);
        assert.equal(calls[0][0], '/\n\tExpected element \'x\' instead of \'y\'');
      });
    });

    it('aborts when local xml is different from remote xml and the user requests an abort', () => {
      sinon.stub(readline, 'keyInYN').returns(true);
      sinon.stub(readline, 'keyInSelect').returns(3);
      sinon.stub(api.db, 'get').resolves({ _rev: 'x', _attachments: { xml: { digest: 'abc' } } });
      sinon.stub(api.db, 'getAttachment').resolves(Buffer.from('<?xml version="1.0"?><y />', 'utf8'));
      sinon.stub(fs, 'read').returns('{"localhost/medic":"y"}');
      const localXml = '<?xml version="1.0"?><x />';
      const localDoc = { _id: 'x' };
      return warnUploadOverwrite.preUploadForm(api.db, localDoc, localXml, []).catch(e => {
        assert.equal('configuration modified', e.message);
      });
    });

    it('uploads the local xml if remote xml does not exist', () => {
      let error = new Error('No attachment');
      error.status = 404;
      const getAttachment = sinon.stub(api.db, 'get').rejects(error);
      sinon.stub(fs, 'read').returns('{"localhost/medic":"y"}');
      const localXml = '<?xml version="1.0"?><x />';
      const localDoc = { _id: 'x' };
      return warnUploadOverwrite.preUploadForm(api.db, localDoc, localXml, []).then(() => {
        assert(getAttachment.calledOnce);
      });
    });

  });

});
