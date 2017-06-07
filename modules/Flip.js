'use strict'

const CommandModule = require('../lib/CommandModule')
const UnTaggedResponse = require('./lib/Response/UnTagged')

class FlipModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!flip', {
            'short': 'Flip a table, or put it back',
            'params': [
                'fix (put it back)'
            ]
        })
    }

    Message (message) {
        const params = this._getParams(message)

        if (params.length) {
            return new UnTaggedResponse('┬─┬﻿ ノ( ゜-゜ノ)')
        }

        return new UnTaggedResponse('(╯°□°）╯︵ ┻━┻')
    }
}

module.exports = (parent, config) => {
    return new FlipModule(parent, config)
}
