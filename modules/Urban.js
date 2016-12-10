'use strict'

const CommandModule = require('../CommandModule')
const deferred = require('deferred')
const Urban = require('urban')

class UrbanModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!urban', {
            'short': 'Search Urban Dictionary',
            'params': [
                'keyword'
            ]
        })
    }

    Message (message) {
        const keyword = message.content.replace(/^[^ ]+/, '').trim()
        const term = keyword.replace(/\s/g, '+')
        const defer = deferred()

        if (keyword) {
            Urban(term).first(json => {
                if (json === undefined) {
                    defer.resolve("Sorry, I couldn't find a definition for: " + keyword)
                    return
                }

                const definition = '\n**' + json.word + '**\n' +
                    json.definition + '\n\n' +
                    'Example: ' + json.example

                defer.resolve(definition)
            })
        } else {
            defer.reject('gimme something to work with up in here!')
        }

        return defer.promise
    }
}

module.exports = (parent, config) => {
    return new UrbanModule(parent, config)
}
