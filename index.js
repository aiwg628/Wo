const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود في Railway.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const command = new SlashCommandBuilder()
  .setName("protect")
  .setDescription("أوامر حماية السيرفر")
  .addSubcommand(sub =>
    sub
      .setName("confirm")
      .setDescription("إزالة الرتب ذات الصلاحيات وطرد البوتات وحذف الويبهوكات")
  )
  .addSubcommand(sub =>
    sub
      .setName("status")
      .setDescription("عرض حالة الحماية")
  );

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        {
          body: [command.toJSON()]
        }
      );

      console.log(`✅ Registered commands in ${guild.name}`);
    } catch (error) {
      console.error(
        `❌ Failed to register commands in ${guild.name}:`,
        error.message
      );
    }
  }
}

function isAdmin(member) {
  return member.permissions.has(
    PermissionsBitField.Flags.Administrator
  );
}

async function removePermissionRoles(guild) {
  let removed = 0;
  let membersChanged = 0;

  await guild.members.fetch();

  for (const member of guild.members.cache.values()) {

    // لا نلمس البوت نفسه
    if (member.id === client.user.id) continue;

    const roles = member.roles.cache.filter(role => {

      // @everyone
      if (role.id === guild.id) return false;

      // Discord managed roles
      if (role.managed) return false;

      // فقط الرتب التي فيها صلاحيات
      if (role.permissions.bitfield === 0n) return false;

      // لازم البوت يقدر يعدل الرتبة
      if (!role.editable) return false;

      return true;
    });

    if (roles.size === 0) continue;

    try {
      await member.roles.remove(
        roles,
        "Protection: removing permission-bearing roles"
      );

      removed += roles.size;
      membersChanged++;

      console.log(
        `🧹 Removed ${roles.size} permission role(s) from ${member.user.tag}`
      );

    } catch (error) {
      console.error(
        `❌ Failed removing roles from ${member.user.tag}:`,
        error.message
      );
    }
  }

  return {
    removed,
    membersChanged
  };
}

async function kickAllBots(guild) {
  let kicked = 0;

  await guild.members.fetch();

  for (const member of guild.members.cache.values()) {

    if (!member.user.bot) continue;

    // لا يطرد نفسه
    if (member.id === client.user.id) continue;

    if (!member.kickable) {
      console.log(
        `⚠️ Cannot kick ${member.user.tag} - bot role is too high`
      );
      continue;
    }

    try {
      await member.kick(
        "Protection: removing unauthorized bot"
      );

      kicked++;

      console.log(`🤖 Kicked bot: ${member.user.tag}`);

    } catch (error) {
      console.error(
        `❌ Failed kicking ${member.user.tag}:`,
        error.message
      );
    }
  }

  return kicked;
}

async function deleteAllWebhooks(guild) {
  let deleted = 0;

  for (const channel of guild.channels.cache.values()) {

    if (!channel.fetchWebhooks) continue;

    try {
      const webhooks = await channel.fetchWebhooks();

      for (const webhook of webhooks.values()) {

        try {
          await webhook.delete(
            "Protection: deleting webhook"
          );

          deleted++;

          console.log(
            `🔗 Deleted webhook: ${webhook.id}`
          );

        } catch (error) {
          console.error(
            `❌ Failed deleting webhook ${webhook.id}:`,
            error.message
          );
        }
      }

    } catch (error) {
      // بعض القنوات لا تدعم Webhooks
    }
  }

  return deleted;
}

async function fullProtection(guild) {

  console.log(`\n🛡️ Starting protection in ${guild.name}\n`);

  const roles = await removePermissionRoles(guild);

  const bots = await kickAllBots(guild);

  const webhooks = await deleteAllWebhooks(guild);

  return {
    rolesRemoved: roles.removed,
    membersChanged: roles.membersChanged,
    botsKicked: bots,
    webhooksDeleted: webhooks
  };
}

client.once("ready", async () => {

  console.log("================================");
  console.log(`🛡️ Logged in as ${client.user.tag}`);
  console.log(`🏠 Servers: ${client.guilds.cache.size}`);
  console.log("================================");

  await registerCommands();
});

client.on("guildCreate", async guild => {

  try {
    const rest = new REST({
      version: "10"
    }).setToken(TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(
        client.user.id,
        guild.id
      ),
      {
        body: [command.toJSON()]
      }
    );

  } catch (error) {
    console.error(error.message);
  }
});

client.on("interactionCreate", async interaction => {

  if (
    !interaction.isChatInputCommand() ||
    interaction.commandName !== "protect"
  ) {
    return;
  }

  if (!interaction.guild) {
    return interaction.reply({
      content: "❌ هذا الأمر للسيرفرات فقط.",
      ephemeral: true
    });
  }

  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: "❌ تحتاج Administrator لاستخدام الأمر.",
      ephemeral: true
    });
  }

  const subcommand =
    interaction.options.getSubcommand();

  if (subcommand === "status") {

    return interaction.reply({
      content:
        "🛡️ **Protection Bot يعمل**\n\n" +
        "استخدم `/protect confirm` لتنفيذ التنظيف الكامل.",
      ephemeral: true
    });
  }

  if (subcommand === "confirm") {

    await interaction.reply({
      content:
        "⚠️ **بدأت عملية الحماية.**\n\n" +
        "🧹 إزالة الرتب التي تحتوي صلاحيات\n" +
        "🤖 طرد البوتات\n" +
        "🔗 حذف الـ Webhooks",
      ephemeral: true
    });

    try {

      const result =
        await fullProtection(interaction.guild);

      const embed = new EmbedBuilder()
        .setTitle("🛡️ Protection Complete")
        .addFields(
          {
            name: "🧹 Permission Roles Removed",
            value: String(result.rolesRemoved),
            inline: true
          },
          {
            name: "👤 Members Changed",
            value: String(result.membersChanged),
            inline: true
          },
          {
            name: "🤖 Bots Kicked",
            value: String(result.botsKicked),
            inline: true
          },
          {
            name: "🔗 Webhooks Deleted",
            value: String(result.webhooksDeleted),
            inline: true
          }
        )
        .setTimestamp();

      await interaction.channel.send({
        embeds: [embed]
      });

      console.log("\n✅ Protection cleanup finished.");
      console.log(result);

    } catch (error) {

      console.error(
        "❌ Protection failed:",
        error
      );

    }
  }
});

/*
   الحماية المستمرة
   يحذف:
   - رسائل البوتات
   - رسائل Webhooks
   - الرسائل التي تحتوي Embeds
*/

client.on("messageCreate", async message => {

  if (!message.guild) return;

  // لا يحذف رسالة البوت نفسه
  if (message.author.id === client.user.id) {
    return;
  }

  const isBot = message.author.bot;
  const isWebhook = Boolean(message.webhookId);
  const hasEmbed = message.embeds.length > 0;

  if (!isBot && !isWebhook && !hasEmbed) {
    return;
  }

  try {

    await message.delete();

    console.log(
      `🗑️ Deleted message ${message.id} | ` +
      `Bot=${isBot} | ` +
      `Webhook=${isWebhook} | ` +
      `Embed=${hasEmbed}`
    );

  } catch (error) {

    console.error(
      `❌ Could not delete message ${message.id}:`,
      error.message
    );

  }
});

client.on("error", error => {
  console.error("Discord Error:", error);
});

process.on("unhandledRejection", error => {
  console.error("Unhandled Promise:", error);
});

client.login(TOKEN);
