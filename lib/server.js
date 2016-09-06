'use strict';

const Hapi   = require('hapi');
const Conf   = require('./support/conf');

const Memory = new WeakMap();

module.exports = function server(self){

    const conf = self.conf(Conf);

    // Instantiate the server, define getter, setup connections
    const hapi = new Hapi.Server(conf.hapi)
    Memory.set(this, hapi);
    this.set('server', null, { get: getter.bind(this, self) });
    conf.connections.forEach(conn => {
        hapi.connection(conn)
        this.debug(self.path, 'conn', conn);
    });

    const instance$ = this.observable.of({server:hapi, conf});

    // Are there plugins on conf? register them.
    const plugin$ = instance$
        .do(instance => this.events.emit(`${self.path}:plugins~before`, instance))
        .switchMap(instance => rxPlugins.call(this, self, instance)
            .toArray()
            .mapTo(instance))
        .do(instance => this.events.emit(`${self.path}:plugins`, instance));

    // everything ready for the server to start and the Memory to be set.
    const server$ = plugin$
        .do(instance => this.events.emit(`${self.path}:start~before`, instance))
        .switchMap(instance => {
            const start = instance.server.start.bind(instance.server);
            return this.observable.bindNodeCallback(start)().mapTo(instance);
        })
        .do(instance => {
            this.events.emit(`${self.path}:start`, instance);
            this.debug(self.path, 'start', instance);
        });

    return server$.mapTo(this);
}

function getter(self){
    const server = Memory.get(this);
    this.debug(self.path, 'getter',  server);
    return server;
}

function rxPlugins(self, {server,conf}){ return this.observable
    .from(conf.plugins)
    .concatMap(plugin => {
        // Validate each plugin before register it
        // normally hapi validates this,
        // but the properties are so nested that this is necessary.
        if (!this.util.is(plugin).object())
            throw this.error.type({
                name: `${self.path}:plugin`,
                type: 'Object',
                data: plugin
            });
        if (!this.util.is(plugin.register).function())
            throw this.error.type({
                name: `${self.path}:plugin.register`,
                type: 'Function',
                data: plugin.register
            });
        if (!this.util.is(plugin.register.attributes).object())
            throw this.error.type({
                name: `${self.path}:plugin.register.attributes`,
                type: 'Object',
                data: plugin.register.attributes
            });
        // Wrap the plugin in a closure so we can log
        // and emit ~before normal and ~after events
        let name = plugin.register.attributes.name || plugin.register.attributes.pkg.name;
        name = `plugin:${name}`;
        return this.observable.create(observer => {
            this.events.emit(`${self.path}:${name}~before`, plugin);
            this.debug(self.path,  name, 'init');
            const orig = plugin.register;
            plugin.register = (server, options, origNext) => {
                const next = () => {
                    this.events.emit(`${self.path}:${name}`, plugin);
                    this.debug(self.path, name, 'load')
                    observer.next(origNext());
                    observer.complete();
                }
                return orig.call(this, server, options, next);
            }
            plugin.register.attributes = orig.attributes;
            server.register(plugin, err => err && observer.error(err))
        });
    });
}
