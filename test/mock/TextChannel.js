'use strict'

const logger = require('../../logger')
const colors = require('colors')
const util = require('util')

class TextChannel {
    constructor (data) {
        this.id = 0
        this.type = 'text'
        this.name = ''
        this.recipient = null

        if (data) {
            Object.assign(this, data)
        }
    }

    sendMessage (text, embed) {
        if (text && embed.embed) {
            logger.info("Bot would've sent message and RichEmbed to channel:\nTitle: '" + colors.green.bold(text) + "'")
        } else if (text) {
            logger.info("Bot would've sent message to channel:\n" + colors.green.bold(text))
        } else {
            logger.info("Bot would've sent RichEmbed message to channel:")
        }

        if (embed.embed) {
            logger.info(util.inspect(embed, false, 6, true))
        }

        return Promise.resolve(this)
    }

    sendFile (path, filename, content) {

    }
}

module.exports = TextChannel
