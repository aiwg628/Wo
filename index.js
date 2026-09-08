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

// Environment Variables
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Error: Missing DISCORD_TOKEN or CLIENT_ID.");
  process.exit(1);
}

// Slash Commands Definition
const commands = [
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("إرسال لوحة الدعم الفني والتذاكر")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("إرسال رسالة مباشرة للمستخدم")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("المستهدف")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("محتوى الرسالة")
        .setRequired(true)
    )
    .addAttachmentOption(option =>
      option
        .setName("image")
        .setDescription("مرفق اختياري")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("نشر إعلان في الروم الحالية")
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
        .setDescription("صورة الإعلان")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("promo")
    .setDescription("إرسال رسالة ترويجية")
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("محتوى الرسالة")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
].map(command => command.toJSON());

// Register Slash Commands
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("Registering application commands...");

    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    await rest.put(route, { body: commands });
    console.log("Commands registered successfully.");
  } catch (error) {
    console.error("Failed to register commands:", error);
  }
}

// Ready Event
client.once("ready", () => {
  console.log(`Bot initialized as ${client.user.tag}`);

  client.user.setPresence({
    activities: [
      {
        name: "نظام التذاكر والدعم",
        type: 3
      }
    ],
    status: "online"
  });
});

// Ticket Panel Builder
function buildTicketPanel() {
  const embed = new EmbedBuilder()
    .setTitle("مركز الدعم الفني")
    .setDescription(
      "اضغط على الزر أدناه لإنشاء تذكرة جديدة.\nسيتم فتح قناة خاصة للتواصل مع فريق الإدارة."
    )
    .setColor(0x5865f2);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_open")
      .setLabel("إنشاء تذكرة")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

// Main Interaction Handler
client.on("interactionCreate", async interaction => {
  try {
    // Slash Commands Handling
    if (interaction.isChatInputCommand()) {

      // Command: /ticket
      if (interaction.commandName === "ticket") {
        await interaction.reply(buildTicketPanel());
        return;
      }

      // Command: /dm
      if (interaction.commandName === "dm") {
        const user = interaction.options.getUser("user");
        const message = interaction.options.getString("message");
        const image = interaction.options.getAttachment("image");

        const embed = new EmbedBuilder()
          .setDescription(message)
          .setColor(0x5865f2)
          .setTimestamp();

        if (image) {
          embed.setImage(image.url);
        }

        try {
          await user.send({ embeds: [embed] });
        } catch {
          await interaction.reply({
            content: "تعذر إرسال الرسالة، قد تكون الرسائل الخاصة مغلقة لدى المستخدم.",
            ephemeral: true
          });
          return;
        }

        await interaction.reply({
          content: `تم إرسال الرسالة بنجاح إلى ${user}.`,
          ephemeral: true
        });

        // Log action in channel
        await interaction.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("سجل النظام")
              .setDescription(`تم استخدام أمر الرسائل الخاصة للمستخدم ${user} بواسطة ${interaction.user}`)
              .setColor(0x5865f2)
          ]
        });

        return;
      }

      // Command: /announce
      if (interaction.commandName === "announce") {
        const title = interaction.options.getString("title");
        const message = interaction.options.getString("message");
        const image = interaction.options.getAttachment("image");

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(message)
          .setColor(0x5865f2)
          .setTimestamp()
          .setFooter({ text: interaction.guild.name });

        if (image) {
          embed.setImage(image.url);
        }

        await interaction.reply({
          content: "تم نشر الإعلان بنجاح.",
          ephemeral: true
        });

        await interaction.channel.send({ embeds: [embed] });
        return;
      }

      // Command: /promo
      if (interaction.commandName === "promo") {
        const message = interaction.options.getString("message");

        await interaction.reply({
          content: "تم إرسال الترويج بنجاح.",
          ephemeral: true
        });

        await interaction.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("إعلان ترويجي")
              .setDescription(message)
              .setColor(0x5865f2)
              .setTimestamp()
          ]
        });

        return;
      }
    }

    // Button Handling: Open Ticket
    if (interaction.isButton() && interaction.customId === "ticket_open") {
      const guild = interaction.guild;

      const existingChannel = guild.channels.cache.find(
        channel => channel.name === `ticket-${interaction.user.id}`
      );

      if (existingChannel) {
        await interaction.reply({
          content: `لديك تذكرة مفتوحة بالفعل: ${existingChannel}`,
          ephemeral: true
        });
        return;
      }

      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.id}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: guild.members.me.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle("تذكرة جديدة")
        .setDescription("يرجى توضيح استفسارك أو مشكلتك، وسيقوم فريق الإدارة بالرد عليك في أقرب وقت.")
        .setColor(0x57f287);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("إغلاق التذكرة")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${interaction.user}`,
        embeds: [embed],
        components: [row]
      });

      await interaction.reply({
        content: `تم إنشاء التذكرة بنجاح: ${channel}`,
        ephemeral: true
      });

      return;
    }

    // Button Handling: Close Ticket
    if (interaction.isButton() && interaction.customId === "ticket_close") {
      await interaction.reply("سيتم إغلاق القناة خلال 5 ثوانٍ...");

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);

      return;
    }

  } catch (error) {
    console.error("Unhandled Interaction Error:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "حدث خطأ غير متوقع أثناء معالجة الطلب.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// Bot Initialization
(async () => {
  await registerCommands();
  await client.login(TOKEN);
})();
