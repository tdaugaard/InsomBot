'use strict'

const env = require('../config.json')
const logger = require('../logger')
const DiscordBot = require('../bot')
const Message = require('./mock/Message')
const Colors = require('colors')
const deferred = require('deferred')

const chai = require('chai')
const expect = chai.expect
const assert = chai.assert
const chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)

logger.info("Set log level to 'error' while bot is initializing.")
logger.transports.console.level = 'error'
Message.prototype.logger = logger
Message.prototype.colors = Colors

function processMessage (msg) {
    const defer = deferred()

    bot.checkMessageForKeywords(msg.content)
        .then(keyword => {
            // Messages which aren't meant for the bot will simply be ignored.
            if (!keyword) {
                logger.warn('No keyword found')
                return
            }

            bot.runKeywordFunction(keyword, msg)
                .then(defer.resolve, defer.reject)
        })

    return defer.promise
}

const roles = ['@everyone', 'Great Leader', 'Officer', 'Raider']
let bot

before(function (done) {
    const defer = deferred()

    this.timeout(5000)

    bot = new DiscordBot(env)
    bot.on('ready', () => {
        logger.transports.console.level = 'silly'

        defer.resolve(done())
    })

    return defer.promise
})
describe('!token', function () {
    it('should contain the price range and a picture', function () {
        let promise = processMessage(new Message(roles, '!token'))

        return expect(promise).to.eventually.be.a.string()
    })
})

describe('!roll', function () {
    function parseRollResult (msg) {
        return msg.match(/you rolled _(\d+)_ \(\d+ to \d+\)/)[1]
    }

    it('should reject with an error', function () {
        return processMessage(new Message(roles, '!roll lol'))
            .then(function (msg) {
                throw new Error(msg)
            })
            .catch(err => {
                expect(err).to.equal('Please enter a number')
            })
    })

    it('should be within 0 - 100', function () {
        let promise = processMessage(new Message(roles, '!roll'))
            .then(parseRollResult)

        return expect(promise).to.eventually.be.within(0, 100)
    })

    it('should be within 200 - 400', function () {
        let promise = processMessage(new Message(roles, '!roll 200 400'))
        .then(parseRollResult)

        return expect(promise).to.eventually.be.within(200, 400)
    })

    it('should be within 200 - 400', function () {
        let promise = processMessage(new Message(roles, '!roll -200 400'))
        .then(parseRollResult)

        return expect(promise).to.eventually.be.within(0, 400)
    })
})
/*

describe('!break', function () {
    function parseTimerResult (msg) {
        return parseInt(msg.match(/@here (\d+) minutes? break timer set\./)[1])
    }

    it('should reject with an error', function () {
        return processMessage(new Message(roles, '!break lol'))
            .then(function (msg) {
                throw new Error(msg)
            })
            .catch(err => {
                expect(err).to.equal('Please enter positive number')
            })
    })

    it('should set a timer for 20 minutes', function () {
        let promise = processMessage(new Message(roles, '!break 20'))
            .then(parseTimerResult)

        return expect(promise).to.eventually.equal(20)
    })

    it('should reset the timer', function () {
        return processMessage(new Message(roles, '!break -10'))
            .then(function (msg) {
                throw new Error(msg)
            })
            .catch(err => {
                expect(err).to.equal('Please enter positive number')
            })
    })

    it('should reject with an error', function () {
        return processMessage(new Message(roles, '!break 0,5'))
            .then(function (msg) {
                throw new Error(msg)
            })
            .catch(err => {
                expect(err.message).to.equal('@here break timer reset.')
            })
    })

    it('should set a timer for 1 minute', function () {
        let promise = processMessage(new Message(roles, '!break 1'))
            .then(parseTimerResult)

        return expect(promise).to.eventually.equal(1)
    })
})

describe('!doge', function () {
    function parseDogeResult (msg) {
        return !!msg.match(/https:\/\/i\.yais\.dk\/.+\.png/)
    }

    it('should reject with an error', function () {
        return processMessage(new Message(roles, '!doge'))
            .then(function (msg) {
                throw new Error(msg)
            })
            .catch(err => {
                expect(err).to.equal('I ain\'t got nothing to work with _bruh_.')
            })
    })
    it('should return a URL to yais.dk', function () {
        this.timeout(1000)
        let promise = processMessage(new Message(roles, '!doge bark woof meow'))
            .then(parseDogeResult)

        return expect(promise).to.eventually.be.true
    })
})

describe('!alt', function () {
    function parseDogeResult (msg) {
        console.log(msg)
        return !!msg.match(/https:\/\/i\.yais\.dk\/.+\.png/)
    }

    it('should add character as alt to a main', function () {
        let promise = processMessage(new Message(roles, '!alt Demonsdemons Níz'))

        return expect(promise).to.eventually.equal("okay, 'Demonsdemons' is now mapped to 'Níz'.")
    })

    it('should reject adding an existing alt', function () {
        return processMessage(new Message(roles, '!alt Demonsdemons Níz'))
            .then(function (msg) {
                throw new Error(msg)
            })
            .catch(err => {
                expect(err).to.equal("'Demonsdemons' is already mapped to 'Níz'")
            })
    })

    it('should reject adding a main as an alt', function () {
        return processMessage(new Message(roles, '!alt Níz Demonsdemons'))
            .then(function (msg) {
                throw new Error(msg)
            })
            .catch(err => {
                const test = /^cannot map a main as an alt\. _Níz_ is main of/.test(err)
                expect(test).to.be.true
            })
    })

    it('should reject adding a main as an alt', function () {
        return processMessage(new Message(roles, '!alt Níz null'))
            .then(function (msg) {
                throw new Error(msg)
            })
            .catch(err => {
                const test = /^cannot unmap a main as an alt\. _Níz_ is main of/.test(err)
                expect(test).to.be.true
            })
    })

    it('should unmap alt from main', function () {
        let promise = processMessage(new Message(roles, '!alt Demonsdemons null'))

        return expect(promise).to.eventually.equal('okay, \'Demonsdemons\' is unmapped.')
    })
})
describe('!manage', function () {
    function parseDogeResult (msg) {
        console.log(msg)
        return !!msg.match(/https:\/\/i\.yais\.dk\/.+\.png/)
    }

    it('should reject with an error', function () {
        return processMessage(new Message(roles, '!enmod loldongs'))
            .then(function (msg) {
                throw new Error(msg)
            })
            .catch(err => {
                expect(err).to.equal('No such module: loldongs')
            })
    })

    it('such module. very disable. wow', function () {
        let promise = processMessage(new Message(roles, '!dismod Doge'))
            .then(v => {
                return !bot.getModuleByName('Doge').enabled
            })

        return expect(promise).to.eventually.be.false
    })
    it('should reject with an error', function () {
        return processMessage(new Message(roles, '!dismod Doge'))
            .then(function (msg) {
                throw new Error(msg)
            })
            .catch(err => {
                expect(err).to.equal('Module is already disabled.')
            })
    })
})
*/

/* const testMessages = [
    [roles, '!help'],
    [roles, '!help Roll'],
    /*
    [roles, "!att 70"],
    [roles, "!att 5"],
    [roles, '!dlc'],
    [roles, '!dlc 422'],
    [roles, '!dlc 900'],
    [roles, '!flip'],
    [roles, '!flip fox'],
    [roles, '!flip fix'],
    [roles, '!rekt'],
    [roles, '!rekt 5'],
    [roles, '!rekt 12'],
    [roles, '!urban'],
    [roles, '!urban meme'],
    [roles, '!urban fsdknfnfjsdfnksd'],
    [roles, '!wcl'],
    [roles, '!wcl -10'],
    [roles, '!wcl 2.5'],
    [roles, '!wcl 2,5'],

    [roles, '!save'],
    [roles, '!help Doge'],
    [roles, '!enmod Doge'],
    [roles, '!help Doge'],
    [roles, '!reload Doge'],
    [roles, '!triggers'],
    [roles, '!cvar'],
    [roles, '!cvar modules'],
    [roles, '!cvar modules.Doge'],
    [roles, '!cvar set modules.Doge.manyMuchWow.4 extremely'],
    [roles, '!cvar modules.Doge'],
    [roles, '!cvar del modules.Doge.manyMuchWow.4 extremely'],
    [roles, '!cvar modules.Doge'],
    [roles, '!cvar sqlite'],
    [roles, '!cvar set sqlite.test okay'],
    [roles, '!cvar sqlite'],
    [roles, '!cvar del sqlite.test'],
    [roles, '!cvar sqlite'],
    [roles, '!mods'],
    [roles, '!restart']
]
*/
