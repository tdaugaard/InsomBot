'use strict'

const CommandModule = require('../CommandModule')
const numeral = require('numeral')

class RollModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!roll', {
            'short': 'Roll a dice and display the result',
            'params': [
                'min = 0',
                'max = 100'
            ]
        })
    }

    _rollDice (params) {
        const result = {
            low: 0,
            high: 0,
            dice: 0
        }

        if (params.length === 1) {
            result.high = Math.min(1000, parseInt(params[0]))
        } else if (params.length > 1) {
            result.low = Math.max(0, parseInt(params[0]))
            result.high = Math.min(1000, parseInt(params[1]))
        }

        if (isNaN(result.low) || isNaN(result.high)) {
            return Promise.reject('Please enter a number')
        }

        if (result.low > result.high) {
            var tmp = result.high
            result.high = result.low
            result.low = tmp
        }

        result.dice = Math.floor(Math.random() * (result.high - result.low + 1) + result.low)

        return Promise.resolve(result)
    }

    Message (message) {
        const params = this._getParams(message)

        return this._rollDice(params)
            .then(result => {
                const cheated = result.high === result.low
                var shitsOnFireYo = ''

                if (result.dice === result.high && !cheated) {
                    shitsOnFireYo = ' :fire: :first_place:'
                } else
                if (result.dice === result.low) {
                    shitsOnFireYo = ' :facepalm:'
                }

                return 'you rolled _' + numeral(result.dice).format('0,0') +
                      '_ (' + numeral(result.low).format('0,0') + ' to ' +
                      numeral(result.high).format('0,0') + ')' +
                      shitsOnFireYo
            })
    }
}

module.exports = (parent, config) => {
    return new RollModule(parent, config)
}
