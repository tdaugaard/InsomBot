'use strict'

const CommandModule = require('../CommandModule')
const shuffle = require('shuffle-array')
const RektsList = require('./data/rekts.json')

class RektModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!rekt', {
            'short': 'Shows someone what they are.',
            'params': [
                'rekts = 4 (max 10)'
            ]
        })
    }

    _pickRekts (params) {
        let howManyRekts = 3
        let str = '\n'

        if (params.length >= 1) {
            howManyRekts = parseInt(params[0]) - 1
            if (howManyRekts > 10) {
                howManyRekts = 10
            }
        }

        str += '\n'
        str += '☐ Not REKT\n'
        str += shuffle(RektsList)
            .slice(0, howManyRekts)
            .map(v => '☒ ' + v)
            .join('\n')

        return {content: str}
    }

    Message (message) {
        const params = this._getParams(message)

        return Promise.resolve(this._pickRekts(params))
    }
}

module.exports = (parent, config) => {
    return new RektModule(parent, config)
}
