'use strict'

const logger = require('../../../lib/logger')
const Common = require('../../../lib/common')
const cheerio = require('cheerio')
const deferred = require('deferred')
const request = require('request')

class CaHComic {
    constructor (module) {
        module.addTrigger('!rcg', {
            'short': 'Cyanide & Happiness: Random Comic Generator',
            'provider': 'CaH'
        })
    }

    getLatestComic () {
        const defer = deferred()
        const endpoint = 'http://explosm.net/rcg?promo=false'

        request({
            url: endpoint,
            time: true
        }, (err, res, body) => {
            Common.logRequestCompletion(logger, endpoint, err, res)

            if (err || res.statusCode !== 200) {
                defer.reject(err)
                return
            }

            const $ = cheerio.load(body)
            const comicUrl = 'https:' + $('#rcg-comic > img').attr('src')
            const title = $('#page-heading h1').text()

            defer.resolve({
                content: title,
                file: comicUrl
            })
        })

        return defer.promise
    }
}

module.exports = (parent) => {
    return new CaHComic(parent)
}
