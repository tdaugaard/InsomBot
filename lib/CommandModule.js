const intersect = require('array-intersection')

class CommandModule {
    constructor (parent, config) {
        this.bot = parent

        this.triggers = {}

        this.config = Object.assign({
            'enabled': false,
            'owner': false,
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

    allowed (message) {
        const isOwner = message.member.user.id === message.channel.guild.ownerID
        const perm = {
            "check": isOwner,
            "why": 'Owner'
        }

        if (perm.check) {
            return perm
        }

        if (this.config.owner) {
            perm.check = isOwner
            return perm
        }

        perm.check = !this.config.roles.length
        if (perm.check) {
            perm.why = 'Unrestricted'
            return perm
        }

        const userRoles = message.member.roles.map(v => v.name)
        const roles = intersect(userRoles, this.config.roles)

        perm.check = !!roles.length
        perm.why = 'Role' + (perm.check ? ': ' + roles.shift() : '')

        return perm
    }

    Message (message) {
        return 'sorry, but this module has not yet been implemented.'
    }
}

module.exports = CommandModule
