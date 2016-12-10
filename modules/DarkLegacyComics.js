const logger = require('../logger')
const Common = require('../common')
const CommandModule = require('../CommandModule')
const FeedParser = require('feedparser')
const cheerio = require('cheerio')
const deferred = require('deferred')
const request = require('request')
const moment = require('moment')
const cachedRequest = require('cached-request')(request)

class DarkLegacyComicsModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        cachedRequest.setCacheDirectory(this.bot.config.cacheDirectory)

        this.addTrigger('!dlc', {
            'short': 'Display link to latest Dark Legacy Comics .. comic.',
            'params': [
                'comic_id (optional)'
            ]
        })
    }

    _getLatestComic () {
        const defer = deferred()
        const endpoint = 'http://www.darklegacycomics.com/feed.xml'
        const feedparser = new FeedParser()
        let mostRecentComic

        feedparser
            .on('error', (err) => {
                defer.reject(err)
            })
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

                defer.resolve(`${title} is **${mostRecentComic.title}** from ${publishDateString}:\n${imageUrl}`)
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

    _getSpecificComic (comicId) {
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

    Message (message) {
        const params = this._getParams(message)

        if (params.length) {
            return this._getSpecificComic(parseInt(params[0]))
        }

        return this._getLatestComic(params)
    }
}

module.exports = (parent, config) => {
    return new DarkLegacyComicsModule(parent, config)
}
