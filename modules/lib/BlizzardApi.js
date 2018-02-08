'use strict'

const deferred = require('deferred')
const logger = require('../../lib/logger')
const Common = require('../../lib/common')

class BlizzardApi {
    constructor (request, config) {
        this._req = request;
        this.config = Object.assign({}, config);
    }

    _request (uri, args) {
        const endpoint = 'https://' + this.config.region + '.api.battle.net/wow/' + uri;
        const defer = deferred()

        args = Object.assign({}, args, {
            locale: 'en_GB',
            apikey: this.config.apiKey
        });

        this._req({
            url: endpoint,
            json: true,
            useQuerystring: true,
            ttl: 60 * 1000,
            time: true,
            qs: args
        }, (err, res, data) => {
            Common.logRequestCompletion(logger, endpoint, err, res)

            if (!err && res.statusCode === 200) {
                defer.resolve(data.members)
            } else {
                defer.reject(err)
            }
        })

        return defer.promise;
    }

    getGuildMembers () {
        return this._request([
            'guild',
            this.config.realm,
            this.config.guild,
        ].join('/'), {
            fields: "members"
        });
    }
}

module.exports = BlizzardApi
