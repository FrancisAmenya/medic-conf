const { assert, expect } = require('chai');
const sinon = require('sinon');
const readline = require('readline-sync');
const api = require('../api-stub');
const environment = require('../../src/lib/environment');
const testProjectDir = './data/upload-custom-translations/';
const uploadCustomTranslations = require('../../src/fn/upload-custom-translations').execute;

const mockTestDir = testDir => sinon.stub(environment, 'pathToProject').get(() => `${testProjectDir}${testDir}`);

const getTranslationDoc = (lang) => {
  return api.db.get(`messages-${lang}`)
    .then(doc => {
      assert.equal(doc.code, lang);
      assert.equal(doc.type, 'translations');
      return doc;
    });
};

const expectTranslationDocs = (...expectedLangs) => {
  const expectedIds = expectedLangs.map(lang => `messages-${lang}`);
  return api.db
    .allDocs()
    .then(res => {
      const actualIds = res.rows.filter(row => row.id.startsWith('messages-')).map(row => row.id);
      assert.deepEqual(actualIds, expectedIds);
    });
};

describe('upload-custom-translations', () => {
  beforeEach(() => {
    readline.keyInYN = () => true;
    return api.start();
  });
  afterEach(api.stop);

  describe('medic-2.x', () => {
    beforeEach(() => {
      // api/deploy-info endpoint doesn't exist
      api.giveResponses({ status: 404, body: { error: 'not_found' } });
      // medic-client does not have deploy_info property
      return api.db.put({ _id: '_design/medic-client' });
    });

    it('should upload simple translations', () => {
      mockTestDir(`simple`);
      return uploadCustomTranslations()
        .then(() => expectTranslationDocs('en'))
        .then(() => getTranslationDoc('en'))
        .then(messagesEn => {
          assert.deepEqual(messagesEn.values, { a:'first', b:'second', c:'third' });
          assert(!messagesEn.generic);
          assert(!messagesEn.custom);
        });
    });

    it('should upload translations for multiple languages', () => {
      mockTestDir(`multi-lang`);
      return uploadCustomTranslations()
        .then(() => expectTranslationDocs('en', 'fr'))
        .then(() => getTranslationDoc('en'))
        .then(messagesEn => {
          assert(messagesEn.name === 'English');
          assert.deepEqual(messagesEn.values, { one: 'one' });
          assert(!messagesEn.generic);
          assert(!messagesEn.custom);
        })
        .then(() => getTranslationDoc('fr'))
        .then(messagesFr => {
          assert(messagesFr.name === 'Français (French)');
          assert.deepEqual(messagesFr.values, { one: 'un(e)' });
          assert(!messagesFr.generic);
          assert(!messagesFr.custom);
        });
    });

    it('should upload translations containing equals signs', () => {
      mockTestDir(`contains-equals`);
      return uploadCustomTranslations()
        .then(() => expectTranslationDocs('en'))
        .then(() => getTranslationDoc('en'))
        .then(messagesEn => {
          assert.deepEqual(messagesEn.values, {
            'some.words':'one equals one',
            'some.maths':'1 + 1 = 2',
          });
          assert(!messagesEn.generic);
          assert(!messagesEn.custom);
        });
    });

    it('should work correctly when falling back to testing messages-en', () => {
      mockTestDir(`custom-lang`);
      return api.db
        .put({
          _id: 'messages-en',
          code: 'en',
          name: 'English',
          type: 'translations',
          values: { a: 'first' }
        })
        .then(() => uploadCustomTranslations())
        .then(() => expectTranslationDocs('en', 'fr'))
        .then(() => getTranslationDoc('en'))
        .then(messagesEn => {
          assert.deepEqual(messagesEn.values, { a:'first' });
          assert(!messagesEn.generic);
          assert(!messagesEn.custom);
        })
        .then(() => getTranslationDoc('fr'))
        .then(messagesFr => {
          assert.deepEqual(messagesFr.values, { one: 'un(e)' });
          assert(!messagesFr.generic);
          assert(!messagesFr.custom);
        });
    });

    it('should set default name for unknown language', () => {
      mockTestDir(`unknown-lang`);
      return uploadCustomTranslations()
        .then(() => expectTranslationDocs('qp'))
        .then(() => getTranslationDoc('qp'))
        .then(messagesQp => {
          assert(messagesQp.name === 'TODO: please ask admin to set this in settings UI');
        });
    });
  });

  describe('medic-3.x', () => {
    describe('3.0.0', () => {
      beforeEach(() => {
        readline.keyInYN = () => true;
        readline.keyInSelect = () => 0;
        return api.db.put({ _id: '_design/medic-client', deploy_info: { version: '3.0.0' } });
      });
      
      it('should upload simple translations', () => {
        // api/deploy-info endpoint doesn't exist
        api.giveResponses({ status: 404, body: { error: 'not_found' } });
        mockTestDir(`simple`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('en'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert.deepEqual(messagesEn.values, { a:'first', b:'second', c:'third' });
            assert(!messagesEn.generic);
            assert(!messagesEn.custom);
          });
      });

      it('should upload translations for multiple languages', () => {
        // api/deploy-info endpoint doesn't exist
        api.giveResponses({ status: 404, body: { error: 'not_found' } });
        mockTestDir(`multi-lang`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('en', 'fr'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert(messagesEn.name === 'English');
            assert.deepEqual(messagesEn.values, { one: 'one' });
            assert(!messagesEn.generic);
            assert(!messagesEn.custom);
          })
          .then(() => getTranslationDoc('fr'))
          .then(messagesFr => {
            assert(messagesFr.name === 'Français (French)');
            assert.deepEqual(messagesFr.values, { one: 'un(e)' });
            assert(!messagesFr.generic);
            assert(!messagesFr.custom);
          });
      });

      it('should upload translations containing equals signs', () => {
        // api/deploy-info endpoint doesn't exist
        api.giveResponses({ status: 404, body: { error: 'not_found' } });
        mockTestDir(`contains-equals`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('en'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert.deepEqual(messagesEn.values, {
              'some.words':'one equals one',
              'some.maths':'1 + 1 = 2',
            });
            assert(!messagesEn.generic);
            assert(!messagesEn.custom);
          });
      });

      it('should merge with existent translations', () => {
        mockTestDir(`with-customs`);
        return api.db
          .put({
            _id: 'messages-en',
            code: 'en',
            name: 'English',
            type: 'translations',
            values: { a:'first', from_custom:'third' }
          })
          .then(() => uploadCustomTranslations())
          .then(() => expectTranslationDocs('en'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert.deepEqual(messagesEn.values, { a:'first', from_custom: 'overwritten', from_custom_new: 'new' });
            assert(!messagesEn.generic);
            assert(!messagesEn.custom);
          });
      });

      it('should crash for malformed translation files', () => {
        mockTestDir(`with-customs`);
        return api.db
          .put({
            _id: 'messages-en',
            code: 'en',
            name: 'English',
            type: 'translations'
          })
          .then(() => uploadCustomTranslations())
          .catch(err => {
            assert.equal(err.message, 'Existent translation doc messages-en is malformed');
          });
      });

      it('should set default name for unknown language', () => {
        mockTestDir(`unknown-lang`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('qp'))
          .then(() => getTranslationDoc('qp'))
          .then(messagesQp => {
            assert(messagesQp.name === 'TODO: please ask admin to set this in settings UI');
          });
      });
    });

    describe('3.4.0', () => {
      beforeEach(() => api.db.put({ _id: '_design/medic-client', deploy_info: { version: '3.4.0' } }));

      it('should upload simple translations', () => {
        // api/deploy-info endpoint doesn't exist
        api.giveResponses({ status: 404, body: { error: 'not_found' } });
        mockTestDir(`simple`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('en'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert.deepEqual(messagesEn.custom, { a:'first', b:'second', c:'third' });
            assert.deepEqual(messagesEn.generic, {});
            assert(!messagesEn.values);
          });
      });

      it('should upload translations for multiple languages', () => {
        // api/deploy-info endpoint doesn't exist
        api.giveResponses({ status: 404, body: { error: 'not_found' } });
        mockTestDir(`multi-lang`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('en', 'fr'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert(messagesEn.name === 'English');
            assert.deepEqual(messagesEn.custom, { one: 'one' });
            assert.deepEqual(messagesEn.generic, {});
            assert(!messagesEn.values);
          })
          .then(() => getTranslationDoc('fr'))
          .then(messagesFr => {
            assert(messagesFr.name === 'Français (French)');
            assert.deepEqual(messagesFr.custom, { one: 'un(e)' });
            assert.deepEqual(messagesFr.generic, {});
            assert(!messagesFr.values);
          });
      });

      it('should upload translations containing equals signs', () => {
        // api/deploy-info endpoint doesn't exist
        api.giveResponses({ status: 404, body: { error: 'not_found' } });
        mockTestDir(`contains-equals`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('en'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert.deepEqual(messagesEn.custom, {
              'some.words':'one equals one',
              'some.maths':'1 + 1 = 2',
            });
            assert.deepEqual(messagesEn.generic, {});
            assert(!messagesEn.values);
          });
      });

      it('should replace existent custom values', () => {
        mockTestDir(`with-customs`);
        return api.db
          .put({
            _id: 'messages-en',
            code: 'en',
            name: 'English',
            type: 'translations',
            generic: { a: 'first' },
            custom: { c: 'third' }
          })
          .then(() => uploadCustomTranslations())
          .then(() => expectTranslationDocs('en'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert.deepEqual(messagesEn.generic, { a: 'first' });
            assert.deepEqual(messagesEn.custom, { from_custom: 'overwritten', from_custom_new: 'new' });
            assert(!messagesEn.values);
          });
      });

      it('should replace delete custom values', () => {
        mockTestDir(`no-customs`);
        return api.db
          .put({
            _id: 'messages-en',
            code: 'en',
            name: 'English',
            type: 'translations',
            generic: { a: 'first' },
            custom: { c: 'third' }
          })
          .then(() => uploadCustomTranslations())
          .then(() => expectTranslationDocs('en'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert.deepEqual(messagesEn.generic, { a: 'first' });
            assert.deepEqual(messagesEn.custom, { });
            assert(!messagesEn.values);
          });
      });

      it('should work correctly when falling back to testing messages-en', () => {
        // api/deploy-info endpoint doesn't exist
        api.giveResponses({ status: 404, body: { error: 'not_found' } });
        mockTestDir(`custom-lang`);
        // for *some* reason, medic-client doesn't have deploy-info
        return api.db
          .get('_design/medic-client')
          .then(ddoc => {
            delete ddoc.deploy_info;
            return api.db.put(ddoc);
          })
          .then(() => api.db.put({
            _id: 'messages-en',
            code: 'en',
            name: 'English',
            type: 'translations',
            generic: { a: 'first' }
          }))
          .then(() => uploadCustomTranslations())
          .then(() => expectTranslationDocs('en', 'fr'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert.deepEqual(messagesEn.generic, { a:'first' });
            assert(!messagesEn.custom);
            assert(!messagesEn.values);
          })
          .then(() => getTranslationDoc('fr'))
          .then(messagesFr => {
            assert.deepEqual(messagesFr.custom, { one: 'un(e)' });
            assert.deepEqual(messagesFr.generic, {});
            assert(!messagesFr.values);
          });
      });

      it('should set default name for unknown language', () => {
        mockTestDir(`unknown-lang`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('qp'))
          .then(() => getTranslationDoc('qp'))
          .then(messagesQp => {
            assert(messagesQp.name === 'TODO: please ask admin to set this in settings UI');
          });
      });
    });

    describe('3.5.0', () => {
      beforeEach(() => {
        // api/deploy-info endpoint exists
        api.giveResponses({ body: { version: '3.5.0' } });
        return api.db.put({ _id: '_design/medic-client', deploy_info: { version: '3.5.0' } });
      });

      it('should upload simple translations', () => {
        mockTestDir(`simple`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('en'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert.deepEqual(messagesEn.custom, { a:'first', b:'second', c:'third' });
            assert.deepEqual(messagesEn.generic, {});
            assert(!messagesEn.values);
          });
      });

      it('should upload translations for multiple languages', () => {
        mockTestDir(`multi-lang`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('en', 'fr'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert(messagesEn.name === 'English');
            assert.deepEqual(messagesEn.custom, { one: 'one' });
            assert.deepEqual(messagesEn.generic, {});
            assert(!messagesEn.values);
          })
          .then(() => getTranslationDoc('fr'))
          .then(messagesFr => {
            assert(messagesFr.name === 'Français (French)');
            assert.deepEqual(messagesFr.custom, { one: 'un(e)' });
            assert.deepEqual(messagesFr.generic, {});
            assert(!messagesFr.values);
          });
      });

      it('should upload translations containing equals signs', () => {
        mockTestDir(`contains-equals`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('en'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert.deepEqual(messagesEn.custom, {
              'some.words':'one equals one',
              'some.maths':'1 + 1 = 2',
            });
            assert.deepEqual(messagesEn.generic, {});
            assert(!messagesEn.values);
          });
      });

      it('should set default name for unknown language', () => {
        mockTestDir(`unknown-lang`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('qp'))
          .then(() => getTranslationDoc('qp'))
          .then(messagesQp => {
            assert(messagesQp.name === 'TODO: please ask admin to set this in settings UI');
          });
      });

      it('should properly upload translations containing escaped exclamation marks', () => {
        mockTestDir(`escaped-exclamation`);
        return uploadCustomTranslations()
          .then(() => expectTranslationDocs('en'))
          .then(() => getTranslationDoc('en'))
          .then(messagesEn => {
            assert.deepEqual(messagesEn.custom, {
              'one.escaped.exclamation':'one equals one!',
              'two.escaped.exclamation':'one equals one!!',
            });
            assert.deepEqual(messagesEn.generic, {});
            assert(!messagesEn.values);
          });
      });

    });


  });

  it('should crash for invalid language code', () => {
    mockTestDir(`invalid-lang`);
    return uploadCustomTranslations()
      .then(() => {
        throw new Error('ensures uploadCustomTranslations throws');
      })
      .catch(err => {
        expect(err.message).to.include('bad(code');
      });
  });
});
