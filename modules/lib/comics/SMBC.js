'use strict'

const logger = require('../../../lib/logger')
const Common = require('../../../lib/common')
const FeedParser = require('feedparser')
const cheerio = require('cheerio')
const deferred = require('deferred')
const request = require('request')
const moment = require('moment')
const cachedRequest = require('cached-request')(request)

class SMBCComic {
    constructor (module) {
        cachedRequest.setCacheDirectory(module.bot.config.cacheDirectory)

        module.addTrigger('!smbc', {
            'short': 'Latest Saturday Morning Breakfast Cereal comic',
            'provider': 'SMBC'
        })
    }

    getLatestComic () {
        const defer = deferred()
        const endpoint = 'http://www.smbc-comics.com/rss.php'
        const feedparser = new FeedParser()
        let mostRecentComic

        feedparser
            .on('error', defer.reject)
            .on('readable', function () {
                const item = this.read()

                if (item && !mostRecentComic) {
                    mostRecentComic = item
                }
            })
            .on('end', () => {
                const age = moment().diff(mostRecentComic.pubDate, 'days')
                const $ = cheerio.load(mostRecentComic.summary)
                const imageUrl = $('img').attr('src')

                let publishDateString

                if (age > 0) {
                    publishDateString = age + ' days ago'
                } else {
                    publishDateString = 'today'
                }

                defer.resolve({
                    content: `Latest: **${mostRecentComic.title}** from _${publishDateString}_`,
                    file: imageUrl
                })
            })

        cachedRequest({
            url: endpoint,
            ttl: 86400000,
            time: true
        }, (err, res) => {
            Common.logRequestCompletion(logger, endpoint, err, res)

            if (err || res.statusCode !== 200) {
                defer.reject(err)
            }
        })
        .pipe(feedparser)

        return defer.promise
    }
}

module.exports = (parent) => {
    return new SMBCComic(parent)
}
