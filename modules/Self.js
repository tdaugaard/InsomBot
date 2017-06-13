'use strict'

const CommandModule = require('../lib/CommandModule')
const Common = require('../lib/common')
const FileEmbedResponse = require('./lib/Response/FileEmbed')
const UnTaggedResponse = require('./lib/Response/UnTagged')

const humanize = require('humanize')
const RichEmbed = require('discord.js').RichEmbed
const os = require('os')

class SelfModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!self', {
            'short': 'Show details about the bot.'
        })
        this.addTrigger('!bugs', {
            'short': '99 bugs in the code, 99 bugs in the code, take one down, patch it around, ..'
        })
        this.addTrigger('!good', {
            'short': '👌👀👌👀👌👀👌👀👌👀 good shit go౦ԁ sHit👌 thats ✔ some good👌👌'
        })
    }

    getModules () {
        const botModules = this.bot.getModules()
        const modules = []

        for (const k of Object.keys(botModules)) {
            const module = botModules[k]
            const enabled = module.enabled
            const formatting = enabled ? '**' : '~~'
            let str = formatting + k + formatting

            if (enabled) {
                str += ' (_' + Object.keys(module.getTriggers()).join('_, _') + '_)'
            }

            modules.push(str)
        }

        return modules
    }

    _getRuntimeEnvironment () {
        return Common.runningUnderPM() ? 'Process Manager' : 'Console'
    }

    Message (message) {
        const trigger = this._getTrigger(message)

        if (trigger === 'bugs') {
            return new FileEmbedResponse('https://i.yais.dk/zxYzAY.png', 'True. fucking. story. brah.')
        }

        if (trigger === 'good') {
            return new UnTaggedResponse('👌👀👌👀👌👀👌👀👌👀 good shit go౦ԁ sHit👌 thats ✔ some good👌👌shit right👌👌th 👌 ere👌👌👌 right✔there ✔✔if i do ƽaү so my selｆ 💯 i say so 💯 thats what im talking about right there right there (chorus: ʳᶦᵍʰᵗ ᵗʰᵉʳᵉ) mMMMMᎷМ💯 👌👌 👌НO0ОଠＯOOＯOОଠଠOoooᵒᵒᵒᵒᵒᵒᵒᵒᵒ👌 👌👌 👌 💯 👌 👀 👀 👀 👌👌Good shit')
        }

        if (trigger === 'self') {
            const embed = new RichEmbed({color: 3447003})
            const memoryUsage = process.memoryUsage()

            embed
                .addField('Node.JS', process.version, true)
                .addField('OS', os.type() + ' (' + os.arch() + ')', true)
                .addField('Environment', this._getRuntimeEnvironment(), true)
                .addField('Uptime', Common.relativeTime(process.uptime() * 1000), true)
                .addField('Memory Usage', humanize.filesize(memoryUsage.heapUsed), true)
                .addField('CPU Time', Common.relativeTime(process.cpuUsage().user / 1000), true)
                .addField('Modules/Triggers', this.getModules().join(', '))

            return embed
        }
    }
}

module.exports = (parent, config) => {
    return new SelfModule(parent, config)
}
