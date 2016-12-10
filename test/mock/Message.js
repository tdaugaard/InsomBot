class Message {
    constructor (roles, content) {
        this.author = {
            username: 'TestBot',
            discriminator: '1337',
            nickname: 'Testerino',
            avatar: 'spongebob.jpg',
            bot: false
        }

        this.member = {
            user: Object.assign({}, this.author),
            roles: []
        }

        roles.forEach((v, k) => {
            const roleId = Math.floor(Math.random() * (Number.MAX_SAFE_INTEGER + 1))

            this.member.roles.push({
                id: roleId,
                position: k,
                name: v
            })
        })

        this.channel = {
            id: 1,
            type: 'text',
            name: 'general',
            recipient: Object.assign({}, this.author)
        }

        this.content = content
    }

    reply (text) {
        this.logger.info("Bot would've replied:\n" + this.colors.green.bold(text))
        return Promise.resolve(this)
    }
}

module.exports = Message
