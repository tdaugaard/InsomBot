'use strict'

const CommandModule = require('../CommandModule')

class FlipModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!flip', {
            'short': 'Flip a table, or put it back',
            'params': [
                'how = flip, fix'
            ]
        })
    }

    Message (message) {
        const params = this._getParams(message)

        if (params.length) {
            return Promise.resolve('┬─┬﻿ ノ( ゜-゜ノ)')
        }

        return Promise.resolve('(╯°□°）╯︵ ┻━┻')
    }
}

module.exports = (parent, config) => {
    return new FlipModule(parent, config)
}
