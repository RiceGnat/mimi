# Mimi
Picarto bot for Discord

[Add Mimi to your Discord server](https://discordapp.com/oauth2/authorize?&client_id=359798782512332813&scope=bot&permissions=0x0000cc00)

## Usage
Commands with persistence (such as tracking and options) are specific to the channel that they're entered in.
### Picarto streams
#### Look up a stream:
```
!stream <name>
```
#### Track a stream in the current channel:
```
!track <name>
```
#### Untrack a stream for the current channel:
```
!untrack <name>
```
#### Show a list of streams tracked in the current channel:
```
!tracking
```
### Bot control
#### Set options for the current channel:
```
!set <option> <value>
```
##### Set a notification limit:
```
!set notify-limit <time>[unit:s|m|h]
```
Example values: `30s, 15m, 1h, 0`

Mimi will only send online notifications once in the given interval for each tracked stream. The interval will apply to all streams tracked in the channel. Useful for when streamers have connectivity issues.

If no unit is provided, seconds will be used by default. Set this option to `0` to disable the limit.
##### Turn notifications on/off for private streams:
```
!set notify-private on|off
```
Default behavior is `off`.
### Emotes
#### Use Mimi emotes from Picarto chat:
```
!mimi <emote>
```
Emote names are the same as in Picarto chat (but without the prefix). Example: `!mimi angry`
### Help
#### Show usage and bot information:
```
!help [<command>]
```
If `<command>` is specified, only usage information for that command will be shown. Otherwise, all commands and general bot info will be shown.