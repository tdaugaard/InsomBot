'use strict'

const CommandModule = require('../lib/CommandModule')
const shuffle = require('shuffle-array')
const RektsList = require('./data/rekts.json')
const UnTaggedResponse = require('./lib/Response/UnTagged')

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
            howManyRekts = parseInt(params[0], 10) - 1
            if (howManyRekts > 10) {
                howManyRekts = 10
            }
            else if (!isFinite(howManyRekts) || howManyRekts < 1) {
                throw "don't be a fucking smartass."
            }
        }

        str += '\n'
        str += '☐ Not REKT\n'
        str += shuffle(RektsList)
            .slice(0, howManyRekts)
            .map(v => '☒ ' + v)
            .join('\n')

        return new UnTaggedResponse(str)
    }

    Message (message) {
        const params = this._getParams(message)

        return this._pickRekts(params)
    }
}

module.exports = (parent, config) => {
    return new RektModule(parent, config)
}
