'use strict'

const logger = require('../logger')
const Common = require('../common')
const shuffle = require('shuffle-array')
const deferred = require('deferred')
const request = require('request')
const CommandModule = require('../CommandModule')

class DogeModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!doge', {
            'short': 'Doge-as-a-service. Such functionality. Much help. Very doge. Wow.',
            'params': [
                'word',
                'word',
                'word'
            ]
        })
    }

    _getDoge (params) {
        const defer = deferred()
        const dogeWords = this.config.manyMuchWow
        const manyMuchWow = shuffle(dogeWords).slice(0, Math.min(params.length, dogeWords.length))
        const dogeParams = manyMuchWow.map((v, i) => v + ' ' + params[i])
        const endpoint = `https://yais.dk/r/http://localhost:9875/${dogeParams.join('/')}/wow.png?split=false`

        request({
            url: endpoint,
            followRedirect: false,
            time: true
        }, (err, res, body) => {
            Common.logRequestCompletion(logger, endpoint, err, res)

            if (!err && res.statusCode === 302) {
                return defer.resolve('https:' + res.headers.location)
            }

            defer.reject(err)
        })

        return defer.promise
    }

    Message (message) {
        const defer = deferred()
        const params = this._getParams(message)

        if (!params.length) {
            return Promise.reject('I ain\'t got nothing to work with _bruh_.')
        }

        this._getDoge(params)
            .then(doge => {
                return message.channel.sendFile(doge, "suchdogemuchwow.png")
                    .then(() => defer.resolve(false))
                    .catch(defer.reject)
            })
            .catch(defer.reject)

        return defer.promise
    }
}

module.exports = (parent, config) => {
    return new DogeModule(parent, config)
}
