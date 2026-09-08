const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// =========================
// ENV
// =========================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ DISCORD_TOKEN أو CLIENT_ID غير موجود.");
  process.exit(1);
}

// =========================
// SLASH COMMANDS
// =========================

const commands = [

  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("إرسال لوحة فتح التذاكر")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("إرسال رسالة خاصة لمستخدم")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("المستخدم")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("الرسالة")
        .setRequired(true)
    )
    .addAttachmentOption(option =>
      option
        .setName("image")
        .setDescription("صورة اختيارية")
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("إرسال إعلان")
    .addStringOption(option =>
      option
        .setName("title")
        .setDescription("عنوان الإعلان")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("نص الإعلان")
        .setRequired(true)
    )
    .addAttachmentOption(option =>
      option
        .setName("image")
        .setDescription("صورة اختيارية")
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  new SlashCommandBuilder()
    .setName("promo")
    .setDescription("إرسال برومو بعد الأمر")
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("رسالة البرومو")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    )

].map(command => command.toJSON());

// =========================
// REGISTER COMMANDS
// =========================

async function registerCommands() {

  const rest = new REST({
    version: "10"
  }).setToken(TOKEN);

  try {

    console.log("🔄 تسجيل أوامر السلاش...");

    const route = GUILD_ID
      ? Routes.applicationGuildCommands(
          CLIENT_ID,
          GUILD_ID
        )
      : Routes.applicationCommands(
          CLIENT_ID
        );

    await rest.put(route, {
      body: commands
    });

    console.log("✅ تم تسجيل أوامر السلاش.");

  } catch (error) {

    console.error(
      "❌ خطأ في تسجيل الأوامر:",
      error
    );

  }
}

// =========================
// BOT READY
// =========================

client.once("ready", () => {

  console.log(
    `✅ تم تشغيل البوت: ${client.user.tag}`
  );

  client.user.setPresence({
    activities: [
      {
        name: "🎫 التذاكر",
        type: 3
      }
    ],
    status: "online"
  });

});

// =========================
// TICKET PANEL
// =========================

function ticketPanel() {

  const embed = new EmbedBuilder()
    .setTitle("🎫 الدعم الفني")
    .setDescription(
      "اضغط على الزر الموجود بالأسفل لفتح تذكرة.\n\n" +
      "سيتم إنشاء روم خاص بك للتواصل مع الإدارة."
    )
    .setColor(0x5865f2);

  const row = new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel("فتح تذكرة")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Primary)

    );

  return {
    embeds: [embed],
    components: [row]
  };
}

// =========================
// INTERACTIONS
// =========================

client.on(
  "interactionCreate",
  async interaction => {

    try {

      // =========================
      // SLASH COMMANDS
      // =========================

      if (interaction.isChatInputCommand()) {

        // =========================
        // /ticket
        // =========================

        if (
          interaction.commandName === "ticket"
        ) {

          await interaction.reply(
            ticketPanel()
          );

          return;
        }

        // =========================
        // /dm
        // =========================

        if (
          interaction.commandName === "dm"
        ) {

          const user =
            interaction.options.getUser("user");

          const message =
            interaction.options.getString(
              "message"
            );

          const image =
            interaction.options.getAttachment(
              "image"
            );

          const embed =
            new EmbedBuilder()
              .setDescription(message)
              .setColor(0x5865f2)
              .setTimestamp();

          if (image) {
            embed.setImage(image.url);
          }

          try {

            await user.send({
              embeds: [embed]
            });

          } catch {

            await interaction.reply({
              content:
                "❌ ما قدرت أرسل له بالخاص. ممكن يكون مقفل الخاص.",
              ephemeral: true
            });

            return;
          }

          await interaction.reply({
            content:
              `✅ تم إرسال الرسالة إلى ${user}.`,
            ephemeral: true
          });

          // البرومو بعد الأمر

          await interaction.channel.send({
            embeds: [

              new EmbedBuilder()
                .setTitle("📢 PROMO")
                .setDescription(
                  `تم استخدام أمر **/dm** بواسطة ${interaction.user}`
                )
                .setColor(0x5865f2)

            ]
          });

          return;
        }

        // =========================
        // /announce
        // =========================

        if (
          interaction.commandName ===
          "announce"
        ) {

          const title =
            interaction.options.getString(
              "title"
            );

          const message =
            interaction.options.getString(
              "message"
            );

          const image =
            interaction.options.getAttachment(
              "image"
            );

          const embed =
            new EmbedBuilder()
              .setTitle(title)
              .setDescription(message)
              .setColor(0x5865f2)
              .setTimestamp()
              .setFooter({
                text:
                  interaction.guild.name
              });

          if (image) {
            embed.setImage(image.url);
          }

          await interaction.reply({
            content:
              "✅ تم إرسال الإعلان.",
            ephemeral: true
          });

          await interaction.channel.send({
            embeds: [embed]
          });

          return;
        }

        // =========================
        // /promo
        // =========================

        if (
          interaction.commandName ===
          "promo"
        ) {

          const message =
            interaction.options.getString(
              "message"
            );

          await interaction.reply({
            content:
              "✅ تم تنفيذ البرومو.",
            ephemeral: true
          });

          await interaction.channel.send({

            embeds: [

              new EmbedBuilder()
                .setTitle("📢 PROMO")
                .setDescription(message)
                .setColor(0x5865f2)
                .setTimestamp()

            ]

          });

          return;
        }
      }

      // =========================
      // OPEN TICKET
      // =========================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "ticket_open"
      ) {

        const guild =
          interaction.guild;

        const existing =
          guild.channels.cache.find(
            channel =>
              channel.name ===
              `ticket-${interaction.user.id}`
          );

        if (existing) {

          await interaction.reply({
            content:
              `❌ عندك تذكرة مفتوحة بالفعل: ${existing}`,
            ephemeral: true
          });

          return;
        }

        const channel =
          await guild.channels.create({

            name:
              `ticket-${interaction.user.id}`,

            type:
              ChannelType.GuildText,

            permissionOverwrites: [

              {
                id:
                  guild.roles.everyone.id,

                deny: [
                  PermissionFlagsBits.ViewChannel
                ]
              },

              {
                id:
                  interaction.user.id,

                allow: [

                  PermissionFlagsBits.ViewChannel,

                  PermissionFlagsBits.SendMessages,

                  PermissionFlagsBits.ReadMessageHistory

                ]
              },

              {
                id:
                  guild.members.me.id,

                allow: [

                  PermissionFlagsBits.ViewChannel,

                  PermissionFlagsBits.SendMessages,

                  PermissionFlagsBits.ManageChannels,

                  PermissionFlagsBits.ReadMessageHistory

                ]
              }

            ]

          });

        const embed =
          new EmbedBuilder()
            .setTitle("🎫 تذكرتك")
            .setDescription(
              "اكتب مشكلتك هنا وسيتم الرد عليك من الإدارة."
            )
            .setColor(0x57f287);

        const row =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId(
                  "ticket_close"
                )
                .setLabel(
                  "إغلاق التذكرة"
                )
                .setEmoji("🔒")
                .setStyle(
                  ButtonStyle.Danger
                )

            );

        await channel.send({

          content:
            `${interaction.user}`,

          embeds: [embed],

          components: [row]

        });

        await interaction.reply({

          content:
            `✅ تم فتح التذكرة: ${channel}`,

          ephemeral: true

        });

        return;
      }

      // =========================
      // CLOSE TICKET
      // =========================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "ticket_close"
      ) {

        await interaction.reply(
          "🔒 سيتم إغلاق التذكرة خلال 5 ثواني..."
        );

        setTimeout(() => {

          interaction.channel
            .delete()
            .catch(() => {});

        }, 5000);

        return;
      }

    } catch (error) {

      console.error(error);

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {

        await interaction.reply({

          content:
            "❌ حدث خطأ أثناء تنفيذ الأمر.",

          ephemeral: true

        }).catch(() => {});

      }

    }

  }
);

// =========================
// START
// =========================

(async () => {

  await registerCommands();

  await client.login(TOKEN);

})();
