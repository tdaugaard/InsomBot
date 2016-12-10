# Just Winging It DiscordApp Bot

## Installation
1. `npm install`
2. Rename `config.json.example` to `config.json` and fill in your credentials.
3. Use `node index.js` to run, or set up something like https://github.com/Unitech/pm2 (`pm2 start --name 'DiscordBot' index.js`)

All HTTP request made by the bot to various resources like Warcraft Logs, Dark Legacy Comics, WoW Token Info, etc. is _cached_ using `cached-request` and their `time-to-live` value is hardcoded in the individual modules.

## Tests
Run `npm test` to run available '_unit tests_'.

## Command Modules
This bot uses Command Modules to define the commands available to the bot. The modules are loaded from `modules/*.js`.

A module can be blacklisted from being loaded by setting the key `blacklisted: true` in `config.json`, e.g.

```json
"modules": {
    "TestModule": {
        "blacklisted": true
    }
}
```

If the module is simply disabled (`"enabled": false`), it may still be loaded during run-time using the `Manage` module via `!enmod`, unless _that_ has been disabled.

### Default Modules

#### Attendance
Collects and shows raid attendance from Warcraft Logs combat reports as configured in `config.json`.

_Configuration_

See also `warcraftlogs` configuration for `Wcl` module.

```json
"Attendance": {
    "roles": ["Officer"],
    "filterInactive": 30,
    "sameNameMapping": {
        "MainCharacter": [
            "AltCharacter1", "AltCharacter2"
        ],
    }
}
```

If `filterInactive` non-zero, the attendance list will exclude any characters from the report which has not attended a raid in that number of days.

`sameNameMapping` may be used to map alt characters to main characters to make sure they appear _as one_ in attendance records.

_Trigger_: `!att <num_raids = 12>` Shows attendance percentages.  
_Trigger_: `!alt <alt_name> <main_name>` Map an alt character to a main  
_Trigger_: `!alt <alt_name> null` Remove a an alt character mapping

#### Break
Sets a break timer (per channel)

_Trigger_: `!break <minutes>` Set a break timer that will notify @here when it expires.  
_Trigger_: `!break` Cancel a previously set break timer.

#### DarkLegacyComics
Shows the latest (or specific) comic from http://darklegacycomics.com/

_Trigger_: `!dlc` Show latest comic  
_Trigger_: `!dlc <id>` Show a specific comic using its numeric ID

#### Doge
Uses dogr.io (Doge-as-a-service) to create Doge image macros.

_Configuration_

```json
"Doge": {
    "suchBaseMuchUrl": "http:/dogr.io/",
    "manyMuchWow": [
        "such",
        "many",
        "very",
        "much"
    ]
}
```

`suchBaseMuchUrl` is the base URL endpoint of the Dogr.io service. I run a modified, local version on my server which is why it is configurable.

_Trigger_: `!doge <word> <word> <word>`
Create and display a Doge image macro with the words you give it followed by '_wow_'.
It will _automagically_ randomly prepend words from `Doge.manyMuchWow` to the words.

Example: `!doge git commit` _could_ create an image saying '_such git_' '_many commit_' '_wow_'

#### Flip
Flips a table (or puts it back).

_Trigger_: `!flip` Flips a table.  
_Trigger_: `!flip fix` Puts the table back. Chill, bro.

#### Help
Displays available commands and their usage.

_Trigger_: `!help` Displays help for all modules/triggers available to you.  
_Trigger_: `!help <module>` Displays help for the given module, which may contain additional help as well.

#### Rekt
Shows a list of ways people are REKT.

_Trigger_: `!rekt`  
_Trigger_: `!rekt <number of rekts>`

#### Roll
Roll a random number between 0 - 100 (or optionally another range)

_Trigger_: `!roll` Displays a random number between 0 - 100  
_Trigger_: `!roll 200` Displays a random number between 0 - 200  
_Trigger_: `!roll 200 400` Displays a random number between 200 - 400  

#### Token
Display latest WoW Token price information from https://wowtoken.info/.

_Trigger_: `!token`

#### Urban
Looks up a keyword on Urban Dictionary.

Usage: `!urban <keywords>`

#### Wcl
Displays links to recent combat log reports from Warcraft Logs.

_Trigger_: `!wcl` Shows 3 reports.  
_Trigger_: `!wcl <number of reports>` Shows the given number of reports.

_Configuration_:

```json
"warcraftlogs": {
    "guild": "My Awesome Guild",
    "realm": "Realm",
    "region": "Region",
    "key": "<WCL API key>"
}
```
#### Manage
Admin module to enable/disable modules as well as restart the bot.

_Trigger_: `!mods` Display module status  
_Trigger_: `!dismod <module name>` Disable a module  
_Trigger_: `!enmod <module name>` Enable a module  
_Trigger_: `!reload <module name>` Reloads a module (disable, then enable)  
_Trigger_: `!triggers` Display all triggers and their associated modules  
_Trigger_: `!restart` Restart the bot. Bot will refuse if it isn't running under PM2  
_Trigger_: `!cvar` Display all configuration values in a dot-notation format  
_Trigger_: `!cvar <var_name>` Display a sub-section of the configuration in dot-notation format  
_Trigger_: `!cvar set <var_name> <value>` Set a configuration key in dot-notation to the given value. _Notice:_ Not all options can be set properly. Modules are mostly supported, but not everything is.  
_Trigger_: `!cvar del <var_name>` Delete the sub-section/key given. _Warning:_ You can screw it up bad. Use with caution.  
_Trigger_: `!save` Save current module configuration to `config.json`.

**_Warning_**  
This module can alter the configuration of the bot using `!cvar`, `!enmod`, `!dismod` - but **no** configuration is saved to disk before `!save` is executed. If you screw something up, simply `!restart` the bot and start over.
