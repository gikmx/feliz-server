'use strict';

const PATH   = require('path');
const Test   = require('feliz.test');
const Server = require('../lib/server');

const path = { root: PATH.join(__dirname, 'app') };

const conf = {
    root   : path.root,
    plugins: [Server]
};

const tests = [
    {
        conf,
        desc: 'failing on purpose',
        pass: false
    }
];

const test$ = Test([{
    desc: 'The feliz instance when using the server-hapi plugin',
    test: tests
}]);

test$.subscribe();
