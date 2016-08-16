'use strict';

const Test = require('feliz.test');

const test = new Test([
    {
        desc:'The observable plugin',
        data: [
            {
                desc: 'no route file is found',
                conf: { root: './holamundo' },
                pass: false
            },
            {
                desc:'I am another test',
                conf: { root: './adiosmundo' },
                pass: true
            }
        ]
    },
    {
        desc:'The observable plugin 1',
        data: [
            {
                desc: 'no route file is found 1',
                conf: { root: './holamundo' },
                pass: false
            },
            {
                desc:'I am another test 1',
                conf: { root: './adiosmundo' },
                pass: true
            }
        ]
    }
]);

test.run();
