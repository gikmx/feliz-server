'use strict';

const Hapi   = require('hapi');
const Router = require('feliz-router');

const Memory = new WeakMap();
const Conf   = require('./support/configuration');
const Name   = 'plugins:server';

module.exports = function server(info){ return this
    // load dependencies first
    .plugins.load([Router])
    // Once we have the plugins loaded
    .map(() => {
        // merge this plugin's conf
        this.conf = Conf;
        // Avoid constantly calling the conf getter.
        const conf   = this.conf.server;
        // Create the sever instance an instead od exposing it
        // wrap it around a getter (less noise)
        const server = new Hapi.Server(conf.hapi);
        this.set('server', null, { get: getter.bind(this) });
        const instance = { server, conf };
        this.debug(Name, 'instance', instance);
        // Create the connections specified on conf
        conf.connections.forEach(conn => server.connection(conn))
        return instance;
    })
    // Are there plugins on conf? register them.
    .switchMap(serverInstance => rxPlugins
        .call(this, serverInstance)
        .toArray()
        .mapTo(serverInstance))
    // Are there any routes? (ofcourse there are) register them.
    .switchMap(serverInstance => rxRoutes
        .call(this, serverInstance)
        .toArray()
        .mapTo(serverInstance))
    // everything ready for the server to start and the Memory to be set.
    .switchMap(({server, conf}) => this.observable
        .bindNodeCallback(server.start.bind(server))()
        .do(() => {
            Memory.set(this, server);
            this.debug(Name, 'start');
        }))
    .mapTo(this)
}


function getter(){
    const server = Memory.get(this);
    this.debug(Name, 'getter',  server);
    return server;
}


function rxPlugins({server,conf}){ return this.observable
    .from(conf.plugins)
    .concatMap(plugin => {
        // Validate each plugin before register it
        // normally hapi validates this,
        // but the properties are so nested that this is necessary.
        if (!this.util.is(plugin).object())
            throw this.error.type({
                name: `${Name}:plugin`,
                type: 'Object',
                data: plugin
            });
        if (!this.util.is(plugin.register).function())
            throw this.error.type({
                name: `${Name}:plugin.register`,
                type: 'Function',
                data: plugin.register
            });
        if (!this.util.is(plugin.register.attributes).object())
            throw this.error.type({
                name: `${Name}:plugin.register.attributes`,
                type: 'Object',
                data: plugin.register.attributes
            });
        if (!this.util.is(plugin.register.attributes.name).string())
            throw this.error.type({
                name: `${Name}:plugin.register.attributes.name`,
                type: 'String',
                data: plugin.register.attributes.name
            });
        // Wrap the plugin in a closure so we can log
        // and emit ~before normal and ~after events
        const name = `plugin:${plugin.register.attributes.name}`;
        return this.observable.create(observer => {
            this.events.emit(`${Name}:${name}~before`, plugin);
            this.debug(Name,  name, 'init');
            const orig = plugin.register;
            plugin.register = (server, options, origNext) => {
                const next = () => {
                    this.events.emit(`${Name}:${name}`, plugin);
                    this.debug(Name, name, 'load')
                    observer.next(origNext());
                    observer.complete();
                }
                this.events.emit(`${Name}:${name}~register`, plugin);
                this.debug(Name, name, 'call')
                return orig.call(this, server, options, next);
            }
            plugin.register.attributes = orig.attributes;
            server.register(plugin, err => err && observer.error(err))
        });
    });
}


function rxRoutes({server, conf}){ return this.observable
    .from(this.router.routes)
    .filter(route => route.type === 'http')
    .do(route => {
        // Remove non-standard properties from route.
        const bundle = route.bundle;
        const name   = `route:${bundle.name}`;
        delete route.bundle;
        delete route.type;
        route.handler = (request, reply) => {
            const self = this.util
                .object({ bundle: { name:bundle.name, filename:bundle.path }})
                .merge(route);
            this.events.emit(`${Name}:${name}`, self);
            this.debug(Name, name, 'load', self);
            bundle.data.call(this, request, reply, self);
        }
        this.events.emit(`${Name}:${name}~register`, route);
        this.debug(Name, name, 'register');
        server.route(route);
        return true;
    })
    .toArray()
}
