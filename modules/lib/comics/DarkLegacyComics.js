'use strict'

const logger = require('../../../logger')
const Common = require('../../../common')
const FeedParser = require('feedparser')
const cheerio = require('cheerio')
const deferred = require('deferred')
const request = require('request')
const moment = require('moment')
const cachedRequest = require('cached-request')(request)

class DarkLegacyComicsComic {
    constructor (module) {
        cachedRequest.setCacheDirectory(module.bot.config.cacheDirectory)

        module.addTrigger('!dlc', {
            'short': 'Latest Dark Legacy Comics',
            'provider': 'DarkLegacyComics',
            'params': [
                'comic_id (optional)'
            ]
        })
    }

    getLatestComic () {
        const defer = deferred()
        const endpoint = 'http://www.darklegacycomics.com/feed.xml'
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
                const comicId = mostRecentComic.link.match(/\/(\d+)$/)[1]
                const imageUrl = `http://www.darklegacycomics.com/comics/${comicId}.jpg`
                const title = mostRecentComic.meta.title.replace(/s$/, '')
                let publishDateString

                if (age > 0) {
                    publishDateString = age + ' days ago'
                } else {
                    publishDateString = 'today'
                }

                defer.resolve({content: `${title} is **${mostRecentComic.title}** from ${publishDateString}`, file: imageUrl})
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

    getSpecificComic (comicId) {
        const defer = deferred()
        const endpoint = `http://www.darklegacycomics.com/${comicId}`

        cachedRequest({
            url: endpoint,
            ttl: 86400 * 365 * 1000,
            time: true
        }, (err, res, body) => {
            Common.logRequestCompletion(logger, endpoint, err, res)

            if (err) {
                return defer.reject('No comic with that ID.')
            }

            const $ = cheerio.load(body)
            const missing = !!$('meta[http-equiv="Refresh"]').length

            if (missing) {
                return defer.reject('No comic with that ID.')
            }

            const title = $('title').text().trim()
            const imageSrc = $('.comic-image').attr('src')
            const imageUrl = `http://www.darklegacycomics.com/${imageSrc}`

            defer.resolve(`\n**#${comicId} ${title}**:\n${imageUrl}`)
        })

        return defer.promise
    }
}

module.exports = (parent) => {
    return new DarkLegacyComicsComic(parent)
}
