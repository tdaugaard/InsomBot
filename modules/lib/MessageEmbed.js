'use strict'

class MessageEmbed {
    constructor (title, description) {
        this.color = 3447003
        this.fields = []
        if (title) {
            this.title = title
        }
        if (description) {
            this.description = description
        }
    }

    addField (name, value, inline) {
        this.fields.push({
            name: name,
            value: value,
            inline: inline || false
        })
    }

    setFooter (title, value) {
        this.footer = {
            title: title,
            value: value
        }
    }
}

module.exports = MessageEmbed
