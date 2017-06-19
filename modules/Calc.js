'use strict'

const CommandModule = require('../lib/CommandModule')
const math = require('mathjs')

const util = require('util')
class CalcModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!calc', {
            'short': 'Flip a table, or put it back',
            'params': [
                'fix (put it back)'
            ]
        })
    }

    Message (message) {
        const params = this._getParams(message)

        if (!params.length) {
            throw 'calculate what?'
        }

        let expr = params.join(' ')
        let node
        try {
            node = math.parse(expr)
        } catch (err) {
            return err.toString()
        }

        try {
            const code = node.compile()
            const result = code.eval()
            expr = node.toString()

            return '`' + expr + '` = `' + result + '`'

        } catch (err) {
            return err.toString()
        }
    }
}

module.exports = (parent, config) => {
    return new CalcModule(parent, config)
}
