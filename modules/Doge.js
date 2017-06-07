'use strict'

const logger = require('../lib/logger')
const Common = require('../lib/common')
const shuffle = require('shuffle-array')
const deferred = require('deferred')
const request = require('request')
const CommandModule = require('../lib/CommandModule')
const FileEmbedResponse = require('./lib/Response/FileEmbed')

class DogeModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!doge', {
            'short': 'Doge-as-a-service. Such help. Much doge. Wow.',
            'params': Array.from(new Array(config.manyMuchWow.length), () => 'word')
        })
    }

    getHelp () {
        return 'Doge will help you out a bit and prepend every word you give him with one of [_' + shuffle(this.config.manyMuchWow).join('_, _') + '_]'
    }

    _getDoge (params) {
        const defer = deferred()
        const dogeWords = this.config.manyMuchWow
        const manyMuchWow = shuffle(dogeWords).slice(0, Math.min(params.length, dogeWords.length))
        const dogeParams = manyMuchWow.map((v, i) => v + ' ' + params[i])
        const endpoint = this.config.suchBaseMuchUrl + dogeParams.join('/') + '/wow.png?split=false'

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

    async Message (message) {
        const params = this._getParams(message)

        if (!params.length) {
            throw "I ain't got nothing to work with _bruh_."
        }

        const doge = await this._getDoge(params)

        return new FileEmbedResponse(doge)
    }
}

module.exports = (parent, config) => {
    return new DogeModule(parent, config)
}
