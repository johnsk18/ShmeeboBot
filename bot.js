const Discord = require('discord.js');
const fs = require('fs');
const ytdl = require('ytdl-core');
const bot = new Discord.Client();

function jsonFileToMap(file) { // reads a JSON file to a Map
  if (!fs.existsSync(`./${file}`)) return new Map();
  const readContent = fs.readFileSync(file);
  const jsonReadContents = JSON.parse(readContent);
  let contentMap = new Map(); // map to store user points
  for (let key in jsonReadContents) contentMap.set(key, jsonReadContents[key]);
  return contentMap;
}

function diceRoller(inString) { // handles dice rolls in the pattern "XdY" where X is the rolls and Y are the faces
 let result = {output: '', points: 0};
 const reg = inString.match(/^(\d+)d(\d+)$/);
 if (reg) {
   const pair = reg.slice(1,3).map(x => parseInt(x));
   if (pair.some(x => !Number.isInteger(x) || x <= 0 || x > 1000)) {
     result.output += "Invalid number of points!\n";
   } else {
     if (pair[0] > 10) result.points = Math.floor(Math.random() * (((pair[0] * pair[1]) - pair[0]) + 1)) + pair[0]; // gives a random number between the min and max possible values of roll sums
     else {
       for (let i = 0; i < pair[0]; i++) {
         const roll = Math.floor(Math.random() * pair[1]) + 1;
         result.points += roll;
         result.output += `You rolled a ${roll}!\n`;
       }
     }
     result.output += `You rolled a total of ${result.points}!\n`;
   }
 }
 return result;
}

function strMapToObj(strMap) { // converts a Map to an Object
  let obj = Object.create(null);
  for (let [k,v] of strMap) obj[k] = v;
  return obj;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function swapAudioFile(audioFile) {
  fs.renameSync(`./audio/${audioFile}`, `./temp/${audioFile}`);
  fs.renameSync(`./alt_audio/${audioFile}`, `./audio/${audioFile}`);
  fs.renameSync(`./temp/${audioFile}`, `./alt_audio/${audioFile}`)
}

function playAudio(audioFilename, userChannel) { // plays an audio file in a user's channel
  isReady = false;
  if (botVoiceChannel && botVoiceChannel !== userChannel) botVoiceChannel.leave();
  botVoiceChannel = userChannel;
  botVoiceChannel.join().then(connection => connection.playFile(`./audio/${audioFilename}.mp3`)).catch(console.error);
  isReady = true;
}

async function mapToJSONFile(file, objMap) { // writes a Map to a JSON file
  console.log(objMap);
  let jsonContent = JSON.stringify(strMapToObj(objMap));
  fs.writeFile(file, jsonContent, 'utf8', function (err) {
    if (err) {
      console.log("An error occured while writing JSON Object to File.");
      return console.log(err);
    }
    console.log("JSON file has been saved.");
  });
}

function getVoiceChannels(guild) {
  return guild.channels.filter(channel => channel.type === "voice" && channel.members.size === 0 && channel.speakable && channel.joinable && !["238115894595682305", "392904280786599937"].includes(channel.id));
}

// Initializes vairables and reads existing scores from scores.json
var isReady = true;
var botVoiceChannel = null;
var scores = jsonFileToMap("scores.json");
var userThemes = jsonFileToMap("themes.json");
var eightBallAnswers = Array("It is certain.",
                             "It is decidedly so.",
                             "Without a doubt.",
                             "Yes - definitely.",
                             "You may rely on it.",
                             "As I see it, yes.",
                             "Most likely.",
                             "Outlook good.",
                             "Yes.",
                             "Signs point to yes.",
                             "Reply hazy, try again.",
                             "Ask again later.",
                             "Better not tell you now.",
                             "Cannot predict now.",
                             "Concentrate and ask again.",
                             "Don't count on it.",
                             "My reply is no.",
                             "My sources say no.",
                             "Outlook not so good.",
                             "Very doubtful.");
var testMode = false; // for sections of code that are used for testing new features

bot.on("ready", () => {
  console.log(`${bot.user.username} is up and running!`);
  console.log(scores);
  console.log(userThemes);
  bot.user.setActivity(`Dicey Dungeons`);
});

bot.on('message', async msg => {
  if (msg.author.bot) return;
  else if (msg.content === "<@588469685662777346>") msg.channel.send("Type ~help for a list of commands!\n");
  else if (msg.content[0] == '~') { // makes sure command starts with ~
    let output = "";
    let args = msg.content.slice(1).split(' ');
    console.log(`${msg.member.user.username} - ${msg.content.slice(1)}`);
    if (testMode && msg.member.user.id === "190879336339996673") msg.delete(); // deletes any message from bot owner when in testing mode
    switch(args[0]) {
      case '8ball': // prints a random 8ball response
        output += eightBallAnswers[Math.floor(Math.random() * eightBallAnswers.length)];
        break;

      case 'clear': // clears scoreboard
        scores.clear();
        mapToJSONFile("scores.json", scores); // empties JSON file
        output = "Scores cleared!"
        break;

      case 'emojis': // prints a list of emojis
        output += "The current available server emojis:\n" + [...msg.guild.emojis.values()].join();
        break;

      case 'flip': // flips a coin
        output += Math.floor(Math.random() * 2) ? "Heads!\n" : "Tails!\n";
        break;

      case 'give': // gives a user the desired amount of points
        if (args.length < 3) { // if command doesn't have sufficient arguments
          output += "Invalid number of arguments!\nUsage: ~give <user mention> <amount of points as a number or dice roll>\n";
          break;
        }

        var result = diceRoller(args[2]);
        output += result.output;
        if (result.output && !result.points) break;
        if (result.output) args[2] = result.points;

        if (isNaN(parseFloat(args[2]))) { // if not a number
          output += "Invalid number of points!\n";
          break;
        } else args[2] = parseFloat(args[2]); // parses to float and stores
        if (!isFinite(args[2])) { // if number is infinite
          output += "You can't give that many points!\n";
          break;
        }
        if (args[1] === "everyone" || args[1] === "@everyone") { // adds desired points to all players in scores map
          scores.map(function(value, key) {
            scores.set(key, value + args[2]);
            if (isNaN(scores.get(key)) || !isFinite(scores.get(key))) {
              scores.set(key, 0);
              output += `${key}'s points has been reset because they amassed too many.\n`;
            }
          });
          output += `Everyone has ${args[2]} more points!\n`;
        } else { // parses out username to tally points to scores map
          args[1] = msg.mentions.users.get(args[1].slice(2 + args[1].length - 21, -1));
          if (args[1] === undefined) { // if user cannot be found
            output += "Invalid user!\n";
            break;
          } else args[1] = args[1].id;
          scores.set(args[1], (scores.has(args[1]) ? scores.get(args[1]) : 0) + args[2]);
          if (isNaN(scores.get(args[1])) || !isFinite(scores.get(args[1]))) {
            scores.set(args[1], 0);
            output += `${msg.mentions.users.get(args[1]).username}'s points has been reset because they amassed too many.\n`;
          }
          output += `${msg.mentions.users.get(args[1]).username} has ${scores.get(args[1])} points!\n`;
        }
        mapToJSONFile("scores.json", scores); // updates JSON file with scores
        break;

      case 'help': // prints commands and their descriptions
        output += "Access commands with the prefix ~ infront.\n";
        output += "**8ball** - gives you a magic 8-ball answer.\n";
        output += "**clear** - clears scoreboard.\n";
        output += "**emojis** - lists server emojis.\n";
        output += "**flip** - flips a coin.\n";
        output += "**give** *x* *y* - gives *x* user *y* points, and can support dice rolls.\n";
        output += "**help** - lists descriptions of commands.\n";
        output += "**join** - bot joins your voice channel.\n";
        output += "**joyride** *x* *y* - experience a *x* joyrides in *y* second intervals (best if you have a theme).\n";
        output += "**leave** - bot leaves its voice channel.\n";
        output += "**list** - displays all points for participating users.\n";
        output += "**move** *x* - moves all members in your voice channel to voice channel *x*. For moderators.\n";
        output += "**notheme** - removes a user's theme.\n";
        output += "**ping** - pings the bot.\n";
        output += "**roll** *x*d*y*- rolls *x* amount of *y*-sided dice.\n";
        output += "**swap** *x* - swaps *x* audio file if an alternative version exists. If *x* is ALL, swaps all alternatives.\n"
        output += "**theme** - lists all audio commands. Can be played when entered after ~ prefix.\n";
        output += "**theme** *x* - sets audio file *x* to be played whenever the user joins to a voice channel.\n";
        output += "**themefollow** - toggleable command resulting in their theme following the user across voice channels.\n";
        output += "**where** - tells user the voice channel the bot is in, if connected.\n";
        break;

      case 'join': // adds the bot to user's voice channel
        if (isReady && msg.member.voiceChannel && msg.member.voiceChannel.userLimit === 0) { // joins channels with no user limits
          botVoiceChannel = msg.member.voiceChannel;
          botVoiceChannel.join().catch(console.error);
        }
        break;

      case 'joyride': // moves user across random empty channels a desired amount of times for a desired amount of seconds per move
        if (args.length < 3) output += "Invalid number of arguments!\nUsage: ~joyride <amount of rides (max 20)> <seconds per ride (min 1, max 10)>\n";
        else {
          args[1] = parseInt(args[1]);
          args[2] = parseFloat(args[2]);
          args[1] = args[1] < 1 ? 1 : (args[1] > 20 ? 20 : args[1]);
          args[2] = args[2] < 1 ? 1 : (args[2] > 10 ? 10 : args[2]);
          if (Number.isInteger(args[1]) && !isNaN(args[2])) {
            const lastChannel = msg.member.voiceChannel;
            const voiceChannels = getVoiceChannels(msg.guild);
            for (let i = 0; i < args[1] && msg.member.voiceChannel; i++) {
              if (msg.member.voiceChannel) msg.member.setVoiceChannel(voiceChannels.randomKey());
              await sleep(1000 * args[2]);
            }
            if (msg.member.voiceChannel) msg.member.setVoiceChannel(lastChannel);
          } else output += "Invalid number parsed!\n";
        }
        break;

      case 'leave': // kicks the bot out of voice channel
        if (botVoiceChannel) {
          botVoiceChannel.leave();
          botVoiceChannel = null;
        }
        break;

      case 'list': // prints a list of all points for participating users
        console.log(scores);
        scores.forEach((value, key) => output += `${msg.guild.members.get(key).user.username} has ${value} points!\n`);
        break;

      case 'move': // if user has a high enough role, moves all users in current voice channel to another
        if (msg.member.user.id !== '190879336339996673' && !msg.member.roles.some(role => ["Administrator", "Moderator", "Other Admins"].includes(role.name))) output += "You do not have sufficient privileges to use this command.\n";
        else if (args.length < 2) output += "Invalid number of arguments!\nUsage: ~move <voice channel name>\n";
        else if (!msg.member.voiceChannel) output += "You must be in a voice channel to use this command.\n";
        else {
          const regexName = new RegExp(args.slice(1).join(' ').toLowerCase());
          const destChannel = msg.guild.channels.filter(channel => channel.type === "voice").find(channel => channel.name.toLowerCase().search(regexName) !== -1);
          if (destChannel) msg.member.voiceChannel.members.map(member => member.setVoiceChannel(destChannel.id));
          else output += "Invalid channel name!\n";
        }
        break;

      case 'nickname': // changes the nickname of the bot, only if the owner calls the command
        if (msg.member.user.id !== '190879336339996673') output += "You do not have sufficient privileges to use this command.\n";
        else msg.guild.members.get("588469685662777346").setNickname(args[1]);
        break;

      case 'notheme': // removes a user's theme
        output += userThemes.delete(msg.member.user.id) ? "Your theme has been removed!\n" : "You already have no theme.\n";
        mapToJSONFile("themes.json", userThemes);
        console.log(userThemes);
        break;

      case 'ping': // ping command taken from the Discord.js and Idiot Guide's community
        const m = await msg.channel.send("Ping?");
        m.edit(`Pong! Latency is ${m.createdTimestamp - msg.createdTimestamp} ms. API Latency is ${Math.round(bot.ping)} ms`);
        break;

      case 'roll': // rolls dice in the pattern "XdY" where X is the rolls and Y are the faces
        if (["213790612372193280", "146117937147674625", "434904533974384660"].includes(msg.member.user.id)) msg.reply("you are an enemy of the people.\n");
        else output += args.length < 2 ? "Invalid number of arguments!\nUsage: ~roll <rolls>d<die faces>\n" : diceRoller(args[1]).output;
        break;

      case 'say': // owener command to allow the bot to say specific messages to the current channel
        if (msg.member.user.id !== '190879336339996673') output += "Say whaaaat?\n"
        else {
          output += msg.content.slice(5);
          msg.delete();
        }
        break;

      case 'swap': // swaps alternative files, either one or all of them
        if (args.length < 2) output += "Invalid number of arguments!\nUsage: ~swap <audio file name or ALL>\n";
        else if (args[1] === "ALL") {
          fs.readdirSync('./alt_audio').map(file => swapAudioFile(file));
          output += "All alterntive files have been swapped.\n";
        } else if (fs.existsSync(`./alt_audio/${args[1]}.mp3`)) {
          swapAudioFile(`${args[1]}.mp3`);
          output += `The audio file ${args[1]} has been swapped.\n`;
        } else output += "There is no alternative file for this audio.\n";
        break;

      case 'test': // owner command used to toggle testing mode
        testMode = !testMode;
        if (testMode) msg.delete();
        break;

      case 'theme': // sets a desired audio theme to the user whenever they join a voice channel
        if (args.length < 2) {
          output += "The current available themes: ";
          fs.readdirSync('./audio').map(file => output += `${file.slice(0,-4)}, `);
          output = output.slice(0, -2) + ".\n";
        } else if (fs.existsSync(`./audio/${args[1]}.mp3`)) {
          const theme = userThemes.get(msg.member.user.id);
          userThemes.set(msg.member.user.id, Object.assign(theme ? theme : {}, {follow: theme ? theme.follow : 0, file: args[1]}));
          mapToJSONFile("themes.json", userThemes);
          output += `${args[1]} is now your theme!\n`;
        } else output += "Invalid theme selected. View ~theme for audio names.\n";
        break;

      case "themefollow": // toggleable command resulting in theme following user across channels
        const theme = userThemes.get(msg.member.user.id);
        if (theme) {
          output += theme.follow ? "Your theme will no longer follow you across channels, only when connecting to a voice channel.\n": "Your theme will follow now also you across voice channels.\n";
          userThemes.set(msg.member.user.id, Object.assign(theme, {'follow': 1 - (theme.follow ? 1 : 0)}));
          mapToJSONFile("themes.json", userThemes);
        } else output += "You currently don't have a theme set. Enter command ~theme to see a list of available themes.\n";
        break;

      case "where": // if connect, tells user the voice channel the bot is in
        output += botVoiceChannel ? `I\'m in this voice channel: ${botVoiceChannel}\n` : "I\'m not in a voice channel.\n";
        break;

      default: // handles any audio file commands
        if (isReady && msg.member.voiceChannel && fs.existsSync(`./audio/${args[0]}.mp3`)) playAudio(args[0], msg.member.voiceChannel);
    }
    // Sends output message to Discord
    if (output) msg.channel.send(output);
  }
});

bot.on('voiceStateUpdate', (oldMember, newMember) => { // detects voice state updates from guild members, to play their audio themes in channels with no user limits
  const newUserChannel = newMember.voiceChannel;
  const oldUserChannel = oldMember.voiceChannel;
  const theme = userThemes.get(newMember.user.id);

  if (!oldUserChannel && newUserChannel) { // if user joins a voice channel
    if (theme && isReady && newUserChannel.userLimit === 0) playAudio(theme.file, newUserChannel);
  } else if (oldUserChannel && !newUserChannel) { // if user leaves a voice channel

  } else if (oldUserChannel && newUserChannel && oldUserChannel !== newUserChannel) { // if user moves to a new voice channel
    if (theme && isReady && theme.follow && newUserChannel.userLimit === 0) playAudio(theme.file, newUserChannel);
  }
});

bot.on("error", (ex) => {
  console.error("ERROR " + ex);
});

bot.login(JSON.parse(fs.readFileSync('auth.json', 'utf-8')).token);
