'use strict';

module.exports = function Conf(self){ return {

    /**
     * The defaul configuration options
     * @module Configuration
     * @type object
     */
    [self.name]: {
        /**
         * The main configuration options used when instantiating the server.
         * @type object
         * @kind __optional__ property
         * @see {@link http://hapijs.com/api#server|Hapi: Server}
         */
        hapi: {},

        /**
         * Defines server' number of connections (and their respective options).
         * @type array
         * @kind __required__ property
         * @see {@link {@link http://hapijs.com/api#serverconnectionoptions|Hapi: Server connections}
         */
        connections: [
            { labels: ['main'],  port: process.env.PORT || 8000 }
        ],

        /**
         * Determines the plugins that will be loaded on startup.
         * @type array
         * @kind __optional__ property
         * @see {@link http://hapijs.com/tutorials/plugins|Hapi: Plugins tutorial}
         */
        plugins: [],
    }

}}
