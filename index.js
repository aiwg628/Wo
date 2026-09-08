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
  ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers, // يتطلب تفعيل Server Members Intent من ديسكورد
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// Environment Variables
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// Constants
const SUPPORT_ROLE_ID = "1535334335836590120"; // آيدي رتبة الدعم
const TICKET_CATEGORY_ID = "1546514716753666098"; // آيدي الكاتيجوري

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
    .setDescription("إرسال رسالة مباشرة لمستخدم")
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
    .setName("dmall")
    .setDescription("إرسال رسالة خاصة لجميع أعضاء السيرفر")
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
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

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

// Helper: Delay Execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
  const textContent = 
    "**مركز الطلبات والدعم**\n" +
    "لتقديم طلب جديد أو التواصل مع الإدارة، اضغط على الزر أدناه.";

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_open")
      .setLabel("للطلب اضغط 👇🏻")
      .setStyle(ButtonStyle.Primary)
  );

  return { content: textContent, components: [row] };
}

// Main Interaction Handler
client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {

      // Command: /ticket
      if (interaction.commandName === "ticket") {
        await interaction.channel.send(buildTicketPanel());
        await interaction.deferReply().then(() => interaction.deleteReply());
        return;
      }

      // Command: /dm
      if (interaction.commandName === "dm") {
        const user = interaction.options.getUser("user");
        const message = interaction.options.getString("message");
        const image = interaction.options.getAttachment("image");

        let dmPayload = { content: message };
        if (image) dmPayload.files = [image.url];

        try {
          await user.send(dmPayload);
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

        await interaction.channel.send(
          `**سجل النظام:** تم استخدام أمر الرسائل الخاصة للمستخدم ${user} بواسطة ${interaction.user}`
        );

        return;
      }

      // Command: /dmall (إرسال للجميع)
      if (interaction.commandName === "dmall") {
        const message = interaction.options.getString("message");
        const image = interaction.options.getAttachment("image");

        await interaction.reply({
          content: "بدأت عملية الإرسال لجميع الأعضاء، قد يستغرق الأمر بعض الوقت...",
          ephemeral: true
        });

        const members = await interaction.guild.members.fetch();
        let successCount = 0;
        let failCount = 0;

        let dmPayload = { content: message };
        if (image) dmPayload.files = [image.url];

        for (const [id, member] of members) {
          if (member.user.bot) continue;

          try {
            await member.send(dmPayload);
            successCount++;
          } catch {
            failCount++;
          }

          // فاصل زمني لتجنب إغلاق البوت بواسطة Discord API
          await sleep(1500);
        }

        await interaction.followUp({
          content: `اكتملت العملية.\nتم الإرسال بنجاح إلى: ${successCount}\nفشل الإرسال إلى: ${failCount}`,
          ephemeral: true
        });

        return;
      }

      // Command: /announce
      if (interaction.commandName === "announce") {
        const title = interaction.options.getString("title");
        const message = interaction.options.getString("message");
        const image = interaction.options.getAttachment("image");

        let announceText = `**${title}**\n\n${message}`;
        let announcePayload = { content: announceText };

        if (image) announcePayload.files = [image.url];

        await interaction.reply({
          content: "تم نشر الإعلان بنجاح.",
          ephemeral: true
        });

        await interaction.channel.send(announcePayload);
        return;
      }

      // Command: /promo
      if (interaction.commandName === "promo") {
        const message = interaction.options.getString("message");

        await interaction.reply({
          content: "تم إرسال الترويج بنجاح.",
          ephemeral: true
        });

        await interaction.channel.send(`**إعلان ترويجي:**\n${message}`);
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
        parent: TICKET_CATEGORY_ID,
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

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("إغلاق التذكرة")
          .setStyle(ButtonStyle.Danger)
      );

      const ticketText = 
        `${interaction.user} <@&${SUPPORT_ROLE_ID}>\n` +
        "**تذكرة جديدة**\n" +
        "اكتب تفاصيل طلبك أو مشكلتك هنا وسيقوم الفريق بالرد عليك.";

      await channel.send({
        content: ticketText,
        components: [row]
      });

      await interaction.reply({
        content: `تم إنشاء التذكرة بنجاح: ${channel}`,
        ephemeral: true
      });

      return;
    }

    // Button Handling: Close Ticket (الإدارة فقط)
    if (interaction.isButton() && interaction.customId === "ticket_close") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({
          content: "عذراً، هذا الإجراء مخصص فقط لأعضاء الإدارة.",
          ephemeral: true
        });
        return;
      }

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
