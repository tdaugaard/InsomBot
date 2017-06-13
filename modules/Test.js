'use strict'

const CommandModule = require('../lib/CommandModule')
const Common = require('../lib/common')

class TestModule extends CommandModule {
    constructor(parent, config) {
        super(parent, config)

        this._totalLength = 35

        this.addTrigger('!test', {
            'short': 'Test',
            'params': [
                'test %'
            ]
        })
    }

    _getProgressBar(percentage) {
        const fillLen = Math.ceil((this._totalLength * percentage) / 100)
        const blankLen = this._totalLength - (isFinite(fillLen) ? fillLen : 0)

        return   (fillLen  > 0 ? '▓'.repeat(fillLen) : '')
               + (blankLen > 0 ? '░'.repeat(blankLen) : '')
               + ' ' + percentage + '%'
    }

    async _updateMessage(msg, percentage,) {
        percentage += Common.getRandomInt(4, 24)

        if (percentage > 99) {
            percentage = 99
        }

        try {
            msg = await msg.edit(this._getProgressBar(percentage))

            if (percentage < 99) {
                setTimeout(this._updateMessage.bind(this, msg, percentage), 1000)
            }

            return
        } catch (err) {
            console.error(err)
        }
    }

    async Message (message) {
        const params = this._getParams(message)
        const percentage = params.length ? Math.max(1, parseInt(params.shift(), 10)) : 0

        try {
            const msg = await this.bot.sendChannelMessage(message.channel.id, "Loading, please wait...")

            this._updateMessage(msg, percentage)
        } catch (err) {
            console.error(err)
        }

        return false
    }
}

module.exports = (parent, config) => {
    return new TestModule(parent, config)
}
