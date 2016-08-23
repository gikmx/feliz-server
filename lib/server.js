'use strict';

const Hapi   = require('hapi');
const Router = require('feliz-router');

const Memory = new WeakMap();
const Conf   = require('./support/configuration');
const Name   = 'plugins:server';

module.exports = function server(info){

    // Determine the dependencies that have to be available before setup
    const dep$ = this.plugins.load([Router]);

    const server$ = dep$.map(feliz => {
        // merge server conf
        this.conf = Conf;
        // Avoid constantly calling the conf getter.
        const conf   = this.conf.server;
        const server = new Hapi.Server(conf.hapi);
        // Instead of directly exposing the hapi server,
        // wrap it around a getter (less noise)
        this.set('server', null, { get: getter.bind(this) });
        conf.connections.forEach(conn => server.connection(conn))
        const instance = { server, conf };
        this.debug(Name, 'instance', instance);
        return instance;
    });

    const plugin$ = server$.switchMap(({server,conf}) => this.observable
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
        })
        .mapTo({server, conf})
    );

    const route$ = plugin$.switchMap(({server, conf}) => this.observable
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
        .mapTo({server, conf})
    );

    const response$ = route$.switchMap(({server, conf}) => {
        const start$ = this.observable.create(observer => {
            server.start(err => {
                if (err) return observer.error();
                Memory.set(this, server);
                observer.next(true);
                observer.complete();
            })
        });
        return start$;

    })
    return response$.mapTo(this);
}


function getter(){
    const server = Memory.get(this);
    this.debug(Name, 'getter',  server);
    return server;
}

