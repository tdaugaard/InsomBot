const intersect = require('array-intersection')

class CommandModule {
    constructor (parent, config) {
        this.bot = parent

        this.triggers = {}

        this.config = Object.assign({
            'enabled': false,
            'roles': []
        }, config)
    }

    destructor () {}

    getName () {
        return this.constructor.name.replace(/Module$/, '')
    }

    getHelp () {
        return 'No further help available.'
    }

    set enabled (value) { this.config.enabled = value }
    get enabled () { return this.config.enabled }
    get roles () { return this.config.roles }

    getTriggers () {
        return this.triggers
    }

    clearTriggers () {
        this.triggers = {}

        return this
    }

    addTrigger (name, config) {
        this.triggers[name] = config

        return this
    }

    _getTrigger (message) {
        return message.content.match(/^!(\w+)/)[1]
    }

    _getParams (message) {
        const params = message.content
            .replace(/^!(\w+)/, '')
            .replace(/ +/, ' ')
            .trim()

        return params !== '' ? params.split(' ') : []
    }

    allowed (member) {
        if (!this.config.roles.length) {
            return true
        }

        const userRoles = member.roles.map(v => v.name)

        return !!intersect(userRoles, this.config.roles).length
    }

    Message (message) {
        return 'sorry, but this module has not yet been implemented.'
    }
}

module.exports = CommandModule
