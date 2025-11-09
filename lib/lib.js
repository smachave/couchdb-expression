"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _nano = _interopRequireDefault(require("nano"));
var _chalk = _interopRequireDefault(require("chalk"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
var {
  log
} = console;
var stringifyMessage = message => {
  if (typeof message === 'object') {
    return JSON.stringify(message);
  }
  return message;
};
var info = message => log(_chalk.default.cyan(stringifyMessage(message)));
var error = message => log(_chalk.default.red(stringifyMessage(message)));
var _default = session => {
  session = session || Object;
  var Store = session.Store || class Store {};

  /**
   * The class that gets returned
   */
  class CouchDBStore extends Store {
    /**
     * constructor for the CouchDBStore Class
     * Options get added to it
     * nano instance gets initialized
     * @constructor
     * @param {object} options
     */
    constructor(options) {
      options = options || {};
      super(options);
      this.hostname = options.hostname || 'localhost';
      this.port = options.port || 5984;
      this.username = options.username || 'admin';
      this.password = options.password || 'password';
      this.databaseName = options.database || 'sessions';
      this.https = options.https || false;
      this.setErrorCount = 0;
      this.connection = (0, _nano.default)(this.generateConnectionURL());
    }
    initializeDatabase() {
      var _this = this;
      return _asyncToGenerator(function* () {
        try {
          var db = yield new Promise((resolve, reject) => {
            /**
             * Gets a list of databases existing on the CouchDB Server
             */
            _this.connection.db.list((err, body) => {
              if (err) {
                _this.showError(err, 'Error connecting to the database and fetching DB list. Check credentials.');
                reject(err);
              } else {
                if (body.indexOf(_this.databaseName) === -1) {
                  /**
                   * Creates a new database only if it doesn't already exist
                   */
                  _this.connection.db.create(_this.databaseName, err => {
                    if (err) {
                      _this.showError(err, 'Error while creating the database.');
                      reject(err);
                    }
                    /**
                    * Resolves the DB once it has been created
                    */
                    resolve(_this.connection.db.use(_this.databaseName));
                  });
                } else {
                  /**
                   * If already exists then it resolves it right away
                   */
                  resolve(_this.connection.db.use(_this.databaseName));
                }
              }
            });
          });
          _this.database = db;
          return db;
        } catch (_unused) {
          return Promise.reject('unable to initialize database');
        }
      })();
    }
    showError(err, message) {
      info(message);
      error(err);
    }
    generateConnectionURL() {
      return "".concat(this.https ? 'https' : 'http', "://").concat(this.username, ":").concat(this.password, "@").concat(this.hostname, ":").concat(this.port);
    }

    /**
     * Converts session_id to a CouchDB _id
     * @param {string} sid
     * @return {string}
     */
    sidToCid(sid) {
      return "c".concat(sid);
    }

    /**
     * Gets a proper instance of DB to perform actions
     * @param {function} fn
     */
    execute(fn) {
      this.database ? fn(this.database) : this.initializeDatabase().then(db => fn(db)).catch(() => error('could not execute function'));
    }

    /**
     * Returns a session
     * @param {string} sid 
     * @param {function} callback 
     * @return {object} the session
     */
    get(sid, callback) {
      this.execute(db => {
        db.get(this.sidToCid(sid), (err, doc) => {
          if (err) {
            this.showError(err, 'Attempt to get cookie information from DB failed.');
          }
          callback(err, doc ? doc : null);
        });
      });
    }

    /**
     * Sets a new session
     * @param {string} sid
     * @param {object} session
     * @param {function} callback
     */
    set(sid, session, callback) {
      this.execute(db => (
      /**
       * Prepending `c` to _id because _id fields are not allowed to start
       * with an underscore.
       */
      db.insert(session, this.sidToCid(sid), err => {
        if (err && this.setErrorCount < 3) {
          this.setErrorCount++;
          this.showError(err, 'Attempt to set cookie in DB failed.');
          /**
           * Sometimes due to race-conditions a `Document update conflict`
           * error seems to crop up. This has got to do with CouchDB's internal
           * handling of document updates, and the way to solve this is by
           * literally trying again.
           */
          this.get(sid, (err, doc) => this.set(sid, _objectSpread(_objectSpread({}, session), {}, {
            _rev: doc._rev
          }), callback));
        } else {
          this.setErrorCount = 0;
          callback(err);
        }
      })));
    }

    /**
     * Destroys an existing session
     * @param {string} sid 
     * @param {function} callback 
     */
    destroy(sid, callback) {
      this.get(sid, (err, doc) => this.execute(db => db.destroy(doc._id, doc._rev, err2 => {
        if (err2) {
          this.showError(err2, 'Attempt to destroy the cookie in DB failed.');
        }
        callback(err2);
      })));
    }

    /**
     * Clears all the documents in the DB
     * @param {function} callback 
     */
    clear(callback) {
      this.execute(db => {
        var docs = [];
        db.list({
          include_docs: true
        }, (err, body) => {
          if (err) {
            this.showError(err, 'Attempt to fetch list of all the cookies failed (in clear method).');
            callback(err);
          } else {
            body.rows.forEach(doc => docs.push(_objectSpread(_objectSpread({}, doc.doc), {}, {
              _deleted: true
            })));
            db.bulk({
              docs
            }, err => {
              if (err) {
                this.showError(err, 'Attempt to carry out bulk deletion of cookies in DB failed (in clear method).');
              }
              callback(err);
            });
          }
        });
      });
    }

    /**
     * Gets the number of documents in the DB
     * @param {function} callback 
     */
    length(callback) {
      this.execute(db => db.list((err, body) => {
        if (err) {
          this.showError(err, 'Attempt to fetch the list of all cookies from DB failed (in length method).');
          callback(err, null);
        } else {
          callback(err, body.rows.length);
        }
      }));
    }

    /**
     * Gets all the documents in the DB
     * @param {function} callback 
     */
    all(callback) {
      this.execute(db => db.list({
        include_docs: true
      }, (err, body) => {
        if (err) {
          this.showError(err, 'Attempt to fetch all cookies from DB failed (in all method).');
          callback(err, null);
        } else {
          callback(err, body.rows.map(r => r.doc));
        }
      }));
    }

    /**
     * 
     * @param {string} sid 
     * @param {object} session 
     * @param {function} callback 
     */
    touch(sid, session, callback) {
      this.execute(db => {
        db.insert(_objectSpread(_objectSpread({}, session), {}, {
          cookie: _objectSpread(_objectSpread({}, session.cookie), {}, {
            expires: session.expires && session.maxAge ? new Date(new Date().getTime() + session.maxAge) : session.expires
          })
        }), err => {
          if (err) {
            this.showError(err, 'Attempt to touch failed.');
          }
          callback(err);
        });
      });
    }
  }
  return CouchDBStore;
};
exports.default = _default;