'use strict'

const CommandModule = require('../CommandModule')
const Common = require('../common')
const Raffle = require('./util/Raffle')
const MessageEmbed = require('./util/MessageEmbed')
const numeral = require('numeral')
const moment = require('moment')
const sortBy = require('sort-by')
const Table = require('cli-table2')

class RollModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.pinAnnounceMsg = this.pinAnnounceMsg || false

        this.raffles = {}

        this.addTrigger('!roll', {
            'short': 'Roll a dice and display the result.',
            'params': [
                'min = 0',
                'max = 100'
            ]
        })

        this.addTrigger('!raffle', {
            'short': 'Start a raffle about something and announce a winner later.',
            'params': [
                'prize'
            ]
        })

        this.addTrigger('!winner', {
            'short': 'Announce the winner of an ongoing raffle in 2 minutes.'
        })

        this._loadRaffles()
        this._checkExpiredRaffles()
    }

    getHelp() {
        return 'When you start a raffle everyone will be notified and the raffle will last for 24 hours after which the winner will be announced.' +
               '\nWhen a channel has a raffle going on, any `!roll`s will be restricted to 0 - 100 and only one roll per person.'
               '\n\nIf you want to prematurely announce a winner, simply run `!winner` and the raffle will come to an end in two minutes.' +
               '\nOnly the raffle owner may end the raffle manually.'
    }

    _loadRaffles () {

    }

    _checkExpiredRaffles () {
        for (const k of Object.keys(this.raffles)) {
            if (this.raffles[k].expired()) {
                delete this.raffles[k]
            }
        }

        setTimeout(this._checkExpiredRaffles.bind(this), 1000)
    }

    _startRaffle (msg) {
        const params = this._getParams(msg)

        if (!params.length) {
            return Promise.reject('we need something to raffle about!')
        }

        const raffle = new Raffle(this._raffleExpired.bind(this), params.join(' '))
        raffle.setAuthor(msg.author)
        raffle.setChannel(msg.channel)

        this.raffles[msg.channel.id] = raffle

        return this.bot.sendChannelMessage(
                msg.channel.id,
                `@everyone <@${raffle.author.id}> has started a raffle for **${raffle.about}**!` +
                ' Type `!roll` to participate in the draw.' +
                ` The raffle will automagically end in 24 hours unless ${raffle.author.username} ends it earlier.` +
                ' Any ties will be solved by re-rolling, naturally =)'
            )
            .then(msg => {
                if (this.config.pinAnnounceMsg) {
                    raffle.messageId = msg.id
                    msg.pin()
                }
            })

        return Promise.resolve(raffle)
    }

    _getSortedRaffleRollers (raffle) {
        let rollers = []

        for (const roll of Common.objectIterator(raffle.rolls)) {
            rollers.push(roll)
        }

        rollers.sort(sortBy('dice'))

        return rollers
    }

    _raffleExpired (raffle) {
        const rollers = this._getSortedRaffleRollers(raffle)

        if (!rollers.length) {
            return this.bot.sendChannelMessage(raffle.channel.id, `The raffle for **${raffle.about}** by ${raffle.author.username} is over! Sadly, there were no participants. Such is life.`)
        }

        const winner = rollers.pop()

        if (this.config.pinAnnounceMsg) {
            const channel = this.bot.discord.channels.get(raffle.channel.id)

            channel.fetchPinnedMessages()
                .then(msgs => {
                    const msg = msgs.get(raffle.messageId)
                    if (msg) {
                        msg.unpin()
                    }
                })
        }

        return this.bot.sendChannelMessage(raffle.channel.id,
            `:first_place: The raffle for **${raffle.about}** is over! ${winner.user} is the` +
            ` lucky winner with a roll of **${winner.dice}**! Collect your prize from <@${raffle.author.id}> =D`
        )
    }

    _endRaffle (msg) {
        const params = this._getParams(msg)
        const raffle = this._getRaffle(msg.channel)

        if (!raffle) {
            return Promise.reject('winner of what? There\'s no raffle going on.')
        }

        if (raffle.author.id !== msg.author.id) {
            return Promise.reject(`the current raffle was started by ${raffle.author.username} - please wait until it's over to create yours.`)
        }

        //raffle.reset(120)
        raffle.reset(0)

        return Promise.resolve({content: `@everyone the raffle for **${raffle.about}** will end in 2 minutes! Make sure to \`!roll\` for it, if you haven't already!`})
    }

    _getRaffle (channel) {
        if (!this.raffles.hasOwnProperty(channel.id)) {
            return false
        }

        return this.raffles[channel.id]
    }

    _displayRaffleRolls (msg) {
        const raffle = this._getRaffle(msg.channel)
        const rollers = this._getSortedRaffleRollers(raffle)
        const table = new Table({
            head: ['Who', 'When', 'Roll'],
            chars: { 'top': '', 'top-mid': '', 'top-left': '', 'top-right': '', 'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '', 'left': '', 'left-mid': '', 'mid': '─', 'mid-mid': '┼', 'right': '', 'right-mid': '', 'middle': '|' },
            colAligns: ['left', 'left', 'right'],
            style: {
                head: [],
                border: [],
                compact: true
            }
        })

        const embed = new MessageEmbed(`Raffle by ${raffle.author.username}`)

        embed.addField('Prize', `**${raffle.about}**`, true)
        embed.addField('Expires', 'In ' + Common.relativeTime(moment(raffle.expires).diff(moment())), true)

        rollers
            .slice(0, 5)
            .forEach(v => {
                table.push([
                    v.user.username,
                    moment(v.time).format(this.bot.config.date.short_date),
                    numeral(v.dice).format('0,0')
                ])
            })
        embed.addField('High Rollers', '```' + table.toString() + '```')

        return Promise.resolve({embed: {embed: embed}})
    }

    _rollDice (msg) {
        const raffle = this._getRaffle(msg.channel)
        const params = this._getParams(msg)
        const result = {
            low: 0,
            high: 100,
            dice: 0,
            raffle: raffle
        }

        if (!raffle) {
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
        }

        result.dice = Math.floor(Math.random() * (result.high - result.low + 1) + result.low)

        if (raffle) {
            raffle.addRoll(msg.author, result.dice)
        }

        return Promise.resolve(result)
    }

    Message (message) {
        const trigger = this._getTrigger(message)
        const raffle = this._getRaffle(message.channel)
        let roll
        if (raffle) {
            roll = raffle.getRoll(message.author)
        }

        if (trigger === "roll") {
            if (raffle && roll) {
                return Promise.reject(`you already rolled a _${roll.dice}_ in this raffle.`)
            }

            return this._rollDice(message)
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
                          shitsOnFireYo +
                          (result.raffle ? ` in the raffle for **${result.raffle.about}**` : '')
                })
        }

        if (trigger == "winner") {
            return this._endRaffle(message)
        }

        if (trigger == "raffle") {
            if (raffle) {
                if (raffle.author.id === message.author.id) {
                    return this._displayRaffleRolls(message)
                }

                return Promise.reject({content:
                    `The current raffle by ${raffle.author.username} for **${raffle.about}** will expire on ${raffle.expires}.` +
                    (roll ? ` You rolled _${roll.dice}_.` : ' You have not yet participated!')
                })
            }

            return this._startRaffle(message)
        }
    }
}

module.exports = (parent, config) => {
    return new RollModule(parent, config)
}
