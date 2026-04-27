const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const TOKEN = 'const TOKEN = process.env.TOKEN;';
const CLIENT_ID = '1496782462343188541';
const PLAYERS_FILE = 'players.json';
const TOURNAMENT_FILE = 'tournament.json';
const RANK_SCORE = { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1 };
function loadPlayers() {
  if (!fs.existsSync(PLAYERS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8')); } catch { return {}; }
}
function savePlayers(p) { fs.writeFileSync(PLAYERS_FILE, JSON.stringify(p, null, 2)); }
function loadTournament() {
  if (!fs.existsSync(TOURNAMENT_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(TOURNAMENT_FILE, 'utf8')); } catch { return null; }
}
function saveTournament(t) { fs.writeFileSync(TOURNAMENT_FILE, JSON.stringify(t, null, 2)); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function balancedSplit(list) {
  list.sort((a,b) => b.score-a.score);
  const t1=[],t2=[];
  let s1=0,s2=0;
  for (const p of list) { if(s1<=s2){t1.push(p);s1+=p.score;}else{t2.push(p);s2+=p.score;} }
  return {t1,t2,s1,s2};
}
function buildBracket(tournament) {
  const rounds = tournament.rounds;
  let text = '';
  rounds.forEach((round, ri) => {
    const roundName = ri === rounds.length-1 ? '🏆 ФИНАЛ' : ri === rounds.length-2 ? '🥊 ХАГАС ФИНАЛ' : '⚔️ '+(ri+1)+'-р үе';
    text += '\n'+roundName+'\n';
    round.forEach(match => {
      const t1 = match.team1||'TBD';
      const t2 = match.team2||'TBD';
      const winner = match.winner ? '✅ '+match.winner : '❓';
      text += 'Match '+match.id+': '+t1+' vs '+t2+' → '+winner+'\n';
    });
  });
  return text;
}
let lastMatch = null;
const polls = {};
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages] });
const commands = [
  new SlashCommandBuilder().setName('addplayer').setDescription('Тоглогч нэмэх').addStringOption(o => o.setName('ner').setDescription('Нэр').setRequired(true)).addStringOption(o => o.setName('rank').setDescription('Rank').setRequired(true).addChoices({name:'S',value:'S'},{name:'A',value:'A'},{name:'B',value:'B'},{name:'C',value:'C'},{name:'D',value:'D'},{name:'E',value:'E'})),
  new SlashCommandBuilder().setName('players').setDescription('Жагсаалт харах'),
  new SlashCommandBuilder().setName('removeplayer').setDescription('Тоглогч устгах').addStringOption(o => o.setName('ner').setDescription('Нэр').setRequired(true)),
  new SlashCommandBuilder().setName('clearplayers').setDescription('Бүгдийг устгах'),
  new SlashCommandBuilder().setName('roll').setDescription('Balance roll хийж хуваана'),
  new SlashCommandBuilder().setName('win').setDescription('Хожсон team — admin only').addStringOption(o => o.setName('team').setDescription('CT эсвэл T').setRequired(true).addChoices({name:'CT Side',value:'ct'},{name:'T Side',value:'t'})),
  new SlashCommandBuilder().setName('team').setDescription('Voice channel хуваана').addStringOption(o => o.setName('team1').setDescription('Team1 нэр').setRequired(false)).addStringOption(o => o.setName('team2').setDescription('Team2 нэр').setRequired(false)),
  new SlashCommandBuilder().setName('team_custom').setDescription('Гараас нэр оруулж хуваана').addStringOption(o => o.setName('players').setDescription('Нэрс').setRequired(true)).addStringOption(o => o.setName('team1').setDescription('Team1').setRequired(false)).addStringOption(o => o.setName('team2').setDescription('Team2').setRequired(false)),
  new SlashCommandBuilder().setName('shuffle').setDescription('Дахиад random хуваана'),
  new SlashCommandBuilder().setName('t_start').setDescription('Тэмцээн эхлүүлэх — admin only').addIntegerOption(o => o.setName('bagiin_too').setDescription('Багийн тоо').setRequired(true).addChoices({name:'4 баг',value:4},{name:'8 баг',value:8})),
  new SlashCommandBuilder().setName('t_win').setDescription('Тоглолтын үр дүн — admin only').addIntegerOption(o => o.setName('match').setDescription('Match дугаар').setRequired(true)).addStringOption(o => o.setName('team').setDescription('Хожсон баг').setRequired(true).addChoices({name:'Баг 1',value:'1'},{name:'Баг 2',value:'2'})),
  new SlashCommandBuilder().setName('t_bracket').setDescription('Bracket харах'),
  new SlashCommandBuilder().setName('t_end').setDescription('Тэмцээн дуусгах — admin only'),
  new SlashCommandBuilder().setName('poll').setDescription('Санал асуулга үүсгэх').addStringOption(o => o.setName('asult').setDescription('Асуулт').setRequired(true)).addIntegerOption(o => o.setName('minut').setDescription('Хэдэн минут хүлээх').setRequired(true)),
  new SlashCommandBuilder().setName('flip').setDescription('Зоос шидэх'),
  new SlashCommandBuilder().setName('stats').setDescription('Тоглогчдын статистик харах'),
].map(c => c.toJSON());
client.once('ready', async () => {
  console.log('Bot бэлэн: ' + client.user.tag);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log('Команд бүртгэгдлээ!');
});
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() === '.roll') {
    const num = Math.floor(Math.random() * 100) + 1;
    await message.reply(message.author.username + ' - ' + num);
  }
});
client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    const pollId = interaction.customId.split('_')[1];
    const poll = polls[pollId];
    if (!poll) return interaction.reply({ content: 'Poll дууссан байна!', ephemeral: true });
    const userId = interaction.user.id;
    const vote = interaction.customId.split('_')[0];
    const userName = interaction.user.displayName || interaction.user.username;
poll.yesNames = poll.yesNames.filter(n => n !== userName);
poll.noNames = poll.noNames.filter(n => n !== userName);
if (poll.yes.includes(userId)) poll.yes = poll.yes.filter(id => id !== userId);
if (poll.no.includes(userId)) poll.no = poll.no.filter(id => id !== userId);
if (vote === 'yes') { poll.yes.push(userId); poll.yesNames.push(userName); }
else { poll.no.push(userId); poll.noNames.push(userName); }
    const embed = new EmbedBuilder()
      .setTitle('📊 ' + poll.question)
      .setColor(0x00b4d8)
      .setDescription('✅ Тийм: **'+poll.yes.length+'** хүн'+(poll.yesNames.length?' ('+poll.yesNames.join(', ')+')':'')+'\n❌ Үгүй: **'+poll.no.length+'** хүн'+(poll.noNames.length?' ('+poll.noNames.join(', ')+')':''))
      .setFooter({ text: poll.minut+' минутын дараа дуусна' });
    await interaction.update({ embeds: [embed] });
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction.commandName;
  if (cmd === 'addplayer') {
    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'Зөвхөн админ!', ephemeral: true });
    const ner = interaction.options.getString('ner');
    const rank = interaction.options.getString('rank');
    const p = loadPlayers();
    p[ner] = { rank, score: RANK_SCORE[rank], wins: p[ner]?.wins||0 };
    savePlayers(p);
    await interaction.reply({ content: ner+' ('+rank+') нэмэгдлээ!' });
  }
  if (cmd === 'players') {
    const p = loadPlayers();
    const list = Object.entries(p);
    if (!list.length) return interaction.reply({ content: 'Жагсаалт хоосон!', ephemeral: true });
    list.sort((a,b) => b[1].wins-a[1].wins);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 Тоглогчид').setColor(0x00b4d8).setDescription(list.map(([n,d],i) => (i+1)+'. '+n+' — '+d.rank+' | 🏆 '+(d.wins||0)+' ялалт').join('\n'))] });
  }
  if (cmd === 'removeplayer') {
    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'Зөвхөн админ!', ephemeral: true });
    const ner = interaction.options.getString('ner');
    const p = loadPlayers();
    if (!p[ner]) return interaction.reply({ content: ner+' байхгүй!', ephemeral: true });
    delete p[ner]; savePlayers(p);
    await interaction.reply({ content: ner+' устгагдлаа!' });
  }
  if (cmd === 'clearplayers') {
    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'Зөвхөн админ!', ephemeral: true });
    savePlayers({}); lastMatch = null;
    await interaction.reply({ content: 'Бүх жагсаалт цэвэрлэгдлээ!' });
  }
  if (cmd === 'stats') {
    const p = loadPlayers();
    const list = Object.entries(p);
    if (!list.length) return interaction.reply({ content: 'Жагсаалт хоосон!', ephemeral: true });
    list.sort((a,b) => b[1].wins-a[1].wins);
    const top = list[0];
    let desc = '👑 **Шилдэг тоглогч: '+top[0]+'** ('+top[1].wins+' ялалт)\n\n';
    desc += list.map(([n,d],i) => {
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'▪️';
      return medal+' '+n+' — '+d.rank+' rank | 🏆 '+(d.wins||0)+' ялалт';
    }).join('\n');
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('📊 Статистик').setColor(0xf1c40f).setDescription(desc)] });
  }
  if (cmd === 'flip') {
    const result = Math.random() < 0.5 ? '🪙 ДЭЭД ТАЛ' : '🪙 ДООД ТАЛ';
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🪙 Зоос шидлээ!').setColor(0xf1c40f).setDescription('**'+result+'**')] });
  }
  if (cmd === 'poll') {
    const asult = interaction.options.getString('asult');
    const minut = interaction.options.getInteger('minut');
    const pollId = Date.now().toString();
    polls[pollId] = { question: asult, yes: [], no: [], yesNames: [], noNames: [], minut };
    const embed = new EmbedBuilder()
      .setTitle('📊 '+asult)
      .setColor(0x00b4d8)
      .setDescription('✅ Тийм: **0** хүн\n❌ Үгүй: **0** хүн')
      .setFooter({ text: minut+' минутын дараа дуусна' });
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('yes_'+pollId).setLabel('✅ Тийм').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('no_'+pollId).setLabel('❌ Үгүй').setStyle(ButtonStyle.Danger),
    );
    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    setTimeout(async () => {
      const poll = polls[pollId];
      if (!poll) return;
      const finalEmbed = new EmbedBuilder()
        .setTitle('📊 '+asult+' — ДУУССАН')
        .setColor(0x57f287)
        .setDescription('✅ Тийм: **'+poll.yes.length+'** хүн'+(poll.yesNames.length?' ('+poll.yesNames.join(', ')+')':'')+'\n❌ Үгүй: **'+poll.no.length+'** хүн'+(poll.noNames.length?' ('+poll.noNames.join(', ')+')':'')+'\n\n'+(poll.yes.length>poll.no.length?'✅ **Тийм** хожлоо!':poll.no.length>poll.yes.length?'❌ **Үгүй** хожлоо!':'🤝 **Тэнцлээ!**'));
      await msg.edit({ embeds: [finalEmbed], components: [] });
      delete polls[pollId];
    }, minut * 60 * 1000);
  }
  if (cmd === 'roll') {
    const vc = interaction.member.voice?.channel;
    if (!vc) return interaction.reply({ content: 'Эхлээд Voice Channel-д орж ир!', ephemeral: true });
    const vcMembers = vc.members.filter(m => !m.user.bot).map(m => m.displayName);
    if (vcMembers.length < 2) return interaction.reply({ content: 'Хамгийн багадаа 2 хүн хэрэгтэй!', ephemeral: true });
    const p = loadPlayers();
    const list = vcMembers.filter(n => p[n]).map(n => ({name:n, rank:p[n].rank, score:p[n].score}));
    const unknown = vcMembers.filter(n => !p[n]);
    if (list.length < 2) return interaction.reply({ content: 'Бүртгэгдсэн тоглогч 2-оос бага!', ephemeral: true });
    const {t1,t2,s1,s2} = balancedSplit([...list]);
    lastMatch = { ct: t1.map(x=>x.name), t: t2.map(x=>x.name) };
    const fields = [
      {name:'🔴 CT Side', value:t1.map(x=>x.name+' ('+x.rank+')').join('\n')||'Хоосон', inline:true},
      {name:'🔵 T Side', value:t2.map(x=>x.name+' ('+x.rank+')').join('\n')||'Хоосон', inline:true},
    ];
    if (unknown.length) fields.push({name:'⚠️ Rank бүртгэгдээгүй', value:unknown.join('\n'), inline:false});
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎲 Roll & Team Split').setColor(0x00b4d8).addFields(...fields).setFooter({text:'CT:'+s1+' vs T:'+s2+' | Зөрүү: '+Math.abs(s1-s2)})] });
  }
  if (cmd === 'win') {
    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'Зөвхөн админ!', ephemeral: true });
    if (!lastMatch) return interaction.reply({ content: 'Эхлээд /roll хийнэ үү!', ephemeral: true });
    const team = interaction.options.getString('team');
    const winners = team === 'ct' ? lastMatch.ct : lastMatch.t;
    const p = loadPlayers();
    winners.forEach(name => { if (p[name]) p[name].wins = (p[name].wins||0)+1; });
    savePlayers(p); lastMatch = null;
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 Ялалт бүртгэгдлээ!').setColor(0x57f287).setDescription((team==='ct'?'🔴 CT Side':'🔵 T Side')+' хожлоо!\n\n'+winners.map(n=>n+' +1 ялалт').join('\n'))] });
  }
  if (cmd === 't_start') {
    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'Зөвхөн админ!', ephemeral: true });
    const bagiin_too = interaction.options.getInteger('bagiin_too');
    const p = loadPlayers();
    const list = Object.keys(p);
    if (list.length < bagiin_too) return interaction.reply({ content: bagiin_too+'н баг хүрэхгүй байна!', ephemeral: true });
    const shuffled = shuffle(list);
    const perTeam = Math.floor(shuffled.length/bagiin_too);
    const teams = [];
    for (let i = 0; i < bagiin_too; i++) {
      teams.push({ name: 'Баг '+(i+1), players: shuffled.slice(i*perTeam,(i+1)*perTeam) });
    }
    const rounds = [];
    let matchId = 1;
    let currentTeams = teams.map(t => t.name);
    while (currentTeams.length > 1) {
      const round = [];
      for (let i = 0; i < currentTeams.length; i += 2) {
        round.push({ id: matchId++, team1: currentTeams[i], team2: currentTeams[i+1]||null, winner: null });
      }
      rounds.push(round);
      currentTeams = round.map(() => null);
    }
    const tournament = { teams, rounds, active: true };
    saveTournament(tournament);
    let desc = '🏆 **Тэмцээн эхэллээ!**\n\n';
    teams.forEach(t => { desc += '**'+t.name+':** '+t.players.join(', ')+'\n'; });
    desc += '\n'+buildBracket(tournament);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 CS2 Тэмцээн').setColor(0xf1c40f).setDescription(desc)] });
  }
  if (cmd === 't_bracket') {
    const tournament = loadTournament();
    if (!tournament) return interaction.reply({ content: 'Тэмцээн байхгүй!', ephemeral: true });
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 Bracket').setColor(0xf1c40f).setDescription(buildBracket(tournament))] });
  }
  if (cmd === 't_win') {
    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'Зөвхөн админ!', ephemeral: true });
    const tournament = loadTournament();
    if (!tournament) return interaction.reply({ content: 'Тэмцээн байхгүй!', ephemeral: true });
    const matchId = interaction.options.getInteger('match');
    const teamChoice = interaction.options.getString('team');
    let foundMatch = null, foundRound = -1, foundIdx = -1;
    tournament.rounds.forEach((round, ri) => {
      round.forEach((match, mi) => {
        if (match.id === matchId) { foundMatch = match; foundRound = ri; foundIdx = mi; }
      });
    });
    if (!foundMatch) return interaction.reply({ content: 'Match '+matchId+' олдсонгүй!', ephemeral: true });
    const winner = teamChoice === '1' ? foundMatch.team1 : foundMatch.team2;
    tournament.rounds[foundRound][foundIdx].winner = winner;
    if (foundRound+1 < tournament.rounds.length) {
      const nextMatchIdx = Math.floor(foundIdx/2);
      if (foundIdx%2===0) tournament.rounds[foundRound+1][nextMatchIdx].team1 = winner;
      else tournament.rounds[foundRound+1][nextMatchIdx].team2 = winner;
    }
    const p = loadPlayers();
    const winningTeam = tournament.teams.find(t => t.name === winner);
    if (winningTeam) {
      winningTeam.players.forEach(name => { if (p[name]) p[name].wins = (p[name].wins||0)+1; });
      savePlayers(p);
    }
    const lastRound = tournament.rounds[tournament.rounds.length-1];
    if (lastRound[0].winner) {
      const champion = lastRound[0].winner;
      const champTeam = tournament.teams.find(t => t.name === champion);
      tournament.active = false;
      saveTournament(tournament);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 АВАРГА ТОДОРЛОО!').setColor(0xf1c40f).setDescription('🥇 **'+champion+'** аварга боллоо!\n\n👑 Тоглогчид:\n'+(champTeam?champTeam.players.join('\n'):''))] });
    } else {
      saveTournament(tournament);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ Үр дүн бүртгэгдлээ').setColor(0x57f287).setDescription('Match '+matchId+': **'+winner+'** хожлоо!\n\n'+buildBracket(tournament))] });
    }
  }
  if (cmd === 't_end') {
    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'Зөвхөн админ!', ephemeral: true });
    if (fs.existsSync(TOURNAMENT_FILE)) fs.unlinkSync(TOURNAMENT_FILE);
    await interaction.reply({ content: 'Тэмцээн дуусгагдлаа!' });
  }
  if (cmd === 'team' || cmd === 'shuffle') {
    const vc = interaction.member.voice?.channel;
    if (!vc) return interaction.reply({ content: 'Эхлээд Voice Channel-д орж ир!', ephemeral: true });
    const members = vc.members.filter(m => !m.user.bot);
    if (members.size < 2) return interaction.reply({ content: 'Хамгийн багадаа 2 хүн хэрэгтэй!', ephemeral: true });
    const names = shuffle(members.map(m => m.displayName));
    const half = Math.ceil(names.length/2);
    const n1 = interaction.options.getString?.('team1')||'CT Side';
    const n2 = interaction.options.getString?.('team2')||'T Side';
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎮 CS2 Teams').setColor(0x00b4d8).setDescription(vc.name+'-аас '+names.length+' хүн хуваагдлаа!').addFields({name:'🔴 '+n1,value:names.slice(0,half).map((n,i)=>(i+1)+'. '+n).join('\n'),inline:true},{name:'🔵 '+n2,value:names.slice(half).map((n,i)=>(i+1)+'. '+n).join('\n'),inline:true})] });
  }
  if (cmd === 'team_custom') {
    const names = interaction.options.getString('players').split(',').map(p=>p.trim()).filter(Boolean);
    if (names.length < 2) return interaction.reply({ content: 'Хамгийн багадаа 2 нэр оруул!', ephemeral: true });
    const half = Math.ceil(names.length/2);
    const sh = shuffle(names);
    const n1 = interaction.options.getString('team1')||'CT Side';
    const n2 = interaction.options.getString('team2')||'T Side';
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎮 CS2 Teams').setColor(0x00b4d8).addFields({name:'🔴 '+n1,value:sh.slice(0,half).map((n,i)=>(i+1)+'. '+n).join('\n'),inline:true},{name:'🔵 '+n2,value:sh.slice(half).map((n,i)=>(i+1)+'. '+n).join('\n'),inline:true})] });
  }
});
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!oldState.channel && newState.channel) {
    const member = newState.member;
    if (member.user.bot) return;
    try {
      const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
      const gtts = require('gtts');
      const path = require('path');
      const vc = newState.channel;
      const text = member.displayName + ' орж ирлээ';
      const filePath = path.join(__dirname, 'tts.mp3');
      const speech = new gtts(text, 'mn');
      speech.save(filePath, async (err) => {
        if (err) return;
        const connection = joinVoiceChannel({
          channelId: vc.id,
          guildId: vc.guild.id,
          adapterCreator: vc.guild.voiceAdapterCreator,
        });
        const player = createAudioPlayer();
        const resource = createAudioResource(filePath);
        connection.subscribe(player);
        player.play(resource);
        player.on(AudioPlayerStatus.Idle, () => {
          connection.destroy();
        });
      });
    } catch(e) { console.error(e); }
  }
});
client.login(TOKEN);