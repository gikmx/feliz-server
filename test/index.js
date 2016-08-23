'use strict';

const PATH   = require('path');
const Test   = require('feliz.test');
const Request = require('supertest');

const Server = require('../lib/server');

const path = { root: PATH.join(__dirname, 'app') };

const conf = {
    root   : path.root,
    plugins: [Server]
};
const PluginFalsy = null;
const PluginArray = [];
const PluginEmpty = {};
const PluginValid = {};
const PluginNoAtt = { register:function(){} };
const PluginInAtt = { register:function(){} };
const PluginNoNam = { register:function(){} };
PluginInAtt.register.attributes = 'hola';
PluginNoNam.register.attributes = {}
PluginValid.register = function(server, options, next){
    this.__test = true;
    next();
};
PluginValid.register.attributes = { name: 'PluginValid', version : '0.0.1' };

const test$ = Test([{
    desc: 'An unmodified hapi-server',
    test: [
        {
            desc: 'registering a invalid (falsy) plugin',
            conf: Object.assign({ server:{ plugins:[PluginFalsy] }}, conf),
            pass: false
        },
        {
            desc: 'registering a invalid (non-object) plugin',
            conf: Object.assign({ server:{ plugins:[PluginArray] }}, conf),
            pass: false
        },
        {
            desc: 'registering a invalid (empty object) plugin',
            conf: Object.assign({ server:{ plugins:[PluginEmpty] }}, conf),
            pass: false
        },
        {
            desc: 'registering a invalid (object no attribute) plugin',
            conf: Object.assign({ server:{ plugins:[PluginNoAtt] }}, conf),
            pass: false
        },
        {
            desc: 'registering a invalid (Invalid attributes) plugin',
            conf: Object.assign({ server:{ plugins:[PluginInAtt] }}, conf),
            pass: false
        },
        {
            desc: 'registering a invalid (no name attribute) plugin',
            conf: Object.assign({ server:{ plugins:[PluginNoNam] }}, conf),
            pass: false
        },
        {
            desc: 'registering an valid empty plugin',
            conf: Object.assign({ server:{ plugins:[PluginValid] }}, conf),
            pass: true,
            call: function(tape, response) { return Request(response.server.listener)
                .get('/')
                .expect(200, (err, res) => {
                    tape.equal(err, null, `should not throw an error when ${this.desc}`)
                    response.server.stop({}, err => {
                        const msg1 = `should shutdown normally when ${this.desc}`;
                        const msg2 = `should register the plugin when ${this.desc}`;
                        tape.equal(err, undefined, msg1);
                        tape.equal(response.__test, true, msg2);
                        tape.end();
                    });
                })
            }
        }
    ]
}]);

test$.subscribe();
