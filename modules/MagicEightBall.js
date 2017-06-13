'use strict'

const CommandModule = require('../lib/CommandModule')
const Common = require('../lib/common')

class ProgressSpinner {
    constructor(parent, config) {
        this._progressChars = [0x2598, 0x259D, 0x2597, 0x2596]
            .map(v => String.fromCharCode(v))

        this._index = 0
    }

    get() {
        return this._progressChars[this._index]
    }

    next() {
        ++this._index

        if (this._index === this._progressChars.length) {
            this._index = 0
        }

        return this
    }
}

class MagicEightBallModule extends CommandModule {
    constructor(parent, config) {
        super(parent, config)

        this._responses = [
            "Yes",
            "Maybe",
            "Not likely",
            "No"
        ]

        this.addTrigger('!8ball', {
            'short': 'Magic 8-ball',
            'params': [
                'question'
            ]
        })
    }

    _decideResponse() {
        return '**' + this._responses[Common.getRandomInt(0, this._responses.length - 1)] + '**'
    }

    async _updateMessage(msg, progress, num_left) {
        const text = progress.get() + ' deciding…'

        progress.next()

        try {
            if (msg.author.id !== this.bot.discord.user.id) {
                msg = await this.bot.sendChannelMessage(msg.channel.id, text)
            } else {
                if (num_left > 0) {
                    await msg.edit(text)
                } else {
                    await msg.edit(this._decideResponse())
                }
            }

            if (num_left > 0) {
                setTimeout(this._updateMessage.bind(this, msg, progress, num_left - 1), 1000)
            }

            return
        } catch (err) {
            console.error(err)
        }
    }

    async Message (message) {
        const progress = new ProgressSpinner()
        const params = this._getParams(message)

        try {
            this._updateMessage(message, progress, 5)
        } catch (err) {
            console.error(err)
        }

        return false
    }
}

module.exports = (parent, config) => {
    return new MagicEightBallModule(parent, config)
}
