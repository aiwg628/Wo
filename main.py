import discord
from discord.ext import commands
import asyncio
import datetime
import os
import re
from collections import defaultdict
from threading import Thread
from flask import Flask

# --- خادم ويب وهمي للاستضافة المستمرة ---
app = Flask('')

@app.route('/')
def home():
    return "نظام الحماية يعمل 24/7"

def run_web():
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)

Thread(target=run_web, daemon=True).start()

# --- إعدادات البوت ---
intents = discord.Intents.all()
bot = commands.Bot(command_prefix=".", intents=intents)

# ربط الأيديات بالأسماء
OWNER_NAMES = {
    1422918463034228757: "دحوم",
    1193909445336502386: "ميكا",
    1423421691773714482: "أسامة",
    1248651389874475143: "مها"
}

ALL_OWNERS = list(OWNER_NAMES.keys())

# تخصيص أونرات كل سيرفر على حدة
SERVER_OWNERS = {
    1534256847312130068: [1193909445336502386, 1422918463034228757], # ميكا و دحوم
    1543680902394019898: [1422918463034228757, 1248651389874475143, 1423421691773714482] # دحوم ومها وأسامة
}

# البوتات المستثناة ذات الحصانة الكاملة
EXEMPTED_BOTS = [
    652505019920285707, 
    762217899355013120, 
    1526691977863626802,
    1510521767423246486,
    995698729225027694
]

# الذاكرة المؤقتة
removed_roles_backup = defaultdict(dict)
action_cooldown = defaultdict(list)

# الصلاحيات الخطيرة المراقبة
DANGEROUS_PERMS = ['administrator', 'manage_guild', 'ban_members', 'kick_members', 'manage_roles', 'manage_channels', 'manage_webhooks']

# نمط التحقق من روابط الدعوات
INVITE_REGEX = re.compile(r'(discord\.gg|discord\.com/invite)/[a-zA-Z0-9]+', re.IGNORECASE)

# --- دالة إرسال الإمبيد للأونر ---
async def send_owner_embed(guild: discord.Guild, title: str, offender: discord.Member, action_details: str, target_info=None):
    if not guild:
        return

    target_owners = SERVER_OWNERS.get(guild.id, ALL_OWNERS)
    
    for owner_id in target_owners:
        owner_name = OWNER_NAMES.get(owner_id, "الأونر")
        
        description_text = (
            f"يا هلا **{owner_name}**، تم رصد مخالفة وإيقاف الفاعل لحماية السيرفر.\n\n"
            f"👤 **الفاعل:** {offender.mention} (`{offender.id}`)\n"
            f"📌 **وش سوا:** {action_details}\n"
            f"📍 **السيرفر:** {guild.name}"
        )
        
        embed = discord.Embed(
            title=f"🛡️ تنبيه أمني | {title}",
            description=description_text,
            color=0xFFFFFF,
            timestamp=discord.utils.utcnow()
        )
        
        if target_info:
            embed.add_field(name="🔹 التفاصيل:", value=target_info, inline=False)
        
        embed.set_footer(text=f"حماية تلقائية • {guild.name}")
        
        try:
            owner = bot.get_user(owner_id) or await bot.fetch_user(owner_id)
            if owner:
                await owner.send(embed=embed)
        except Exception:
            pass

# --- دالة قشع الرتب أو الطرد ---
async def strip_roles(member: discord.Member, reason: str, target_info=None):
    if member.id in ALL_OWNERS or member.id in EXEMPTED_BOTS:
        return
        
    if member.bot:
        try:
            await member.kick(reason=f"[الحماية] - {reason}")
            await send_owner_embed(member.guild, "طرد بوت مخالف", member, f"تم طرد البوت (السبب: {reason})", target_info)
        except Exception:
            pass
        return
    
    bot_top_role = member.guild.me.top_role
    all_removable_roles = [role for role in member.roles if not role.is_default() and role.position < bot_top_role.position]
    
    if all_removable_roles:
        removed_roles_backup[member.guild.id][member.id] = all_removable_roles
        try:
            embed_dm = discord.Embed(
                title="⚠️ تنبيه من نظام الحماية",
                description=f"مرحباً {member.mention}، تم سحب رتبك في سيرفر **{member.guild.name}** بسبب:\n❓ {reason}",
                color=0xFFFFFF
            )
            try: await member.send(embed=embed_dm)
            except Exception: pass

            await member.remove_roles(*all_removable_roles, reason=f"[الحماية] - {reason}")
            await send_owner_embed(member.guild, "سحب رتب مخالف", member, reason, target_info)
        except discord.Forbidden:
            pass

# --- دالة فحص سجلات التدقيق ---
async def get_audit_executor(guild, action_type, check_time=5):
    await asyncio.sleep(0.7)
    try:
        async for entry in guild.audit_logs(limit=3, action=action_type):
            now = datetime.datetime.now(datetime.timezone.utc)
            if (now - entry.created_at).total_seconds() < check_time:
                return entry
    except discord.Forbidden:
        pass
    return None

# --- دالة مراقبة التكرار ---
def check_spam_action(user_id, action_name, max_count=3, seconds=5):
    now = datetime.datetime.now(datetime.timezone.utc)
    key = f"{user_id}_{action_name}"
    user_actions = [t for t in action_cooldown[key] if (now - t).total_seconds() < seconds]
    user_actions.append(now)
    action_cooldown[key] = user_actions
    return len(user_actions) > max_count

# ==================== الأحداث وأنظمة الحماية ====================

@bot.event
async def on_ready():
    print(f"✅ تم تسجيل الدخول باسم: {bot.user.name}")
    await bot.change_presence(activity=discord.Activity(type=discord.ActivityType.watching, name="🛡️ نظام الحماية القصوى"))

# 1. حماية القنوات
@bot.event
async def on_guild_channel_delete(channel):
    entry = await get_audit_executor(channel.guild, discord.AuditLogAction.channel_delete)
    if entry and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
        member = channel.guild.get_member(entry.user.id)
        if member:
            await strip_roles(member, f"حذف روم/قناة باسم ({channel.name})", f"النوع: {channel.type}")
            
        if channel.type != discord.ChannelType.voice:
            try: await channel.clone(reason="إعادة إنشاء الروم تلقائياً لحماية هيكل السيرفر")
            except Exception: pass

@bot.event
async def on_guild_channel_update(before, after):
    entry = await get_audit_executor(after.guild, discord.AuditLogAction.channel_update)
    if entry and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
        member = after.guild.get_member(entry.user.id)
        if member:
            await strip_roles(member, f"عدل في إعدادات أو صلاحيات القناة ({after.name})")
            try: await after.edit(name=before.name, topic=before.topic, nsfw=before.nsfw, category=before.category, sync_permissions=True)
            except Exception: pass

@bot.event
async def on_guild_channel_create(channel):
    entry = await get_audit_executor(channel.guild, discord.AuditLogAction.channel_create)
    if entry and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
        if check_spam_action(entry.user.id, "channel_create", max_count=3, seconds=10):
            member = channel.guild.get_member(entry.user.id)
            if member: await strip_roles(member, f"جالس يسوي سبام إنشاء قنوات بكثرة (أحدث روم: {channel.name})")
            try: await channel.delete()
            except Exception: pass

# 2. حماية الرتب والصلاحيات الخطيرة
@bot.event
async def on_guild_role_delete(role):
    entry = await get_audit_executor(role.guild, discord.AuditLogAction.role_delete)
    if entry and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
        member = role.guild.get_member(entry.user.id)
        if member:
            await strip_roles(member, f"حذف الرتبة ({role.name}) من السيرفر")
            try: await role.guild.create_role(name=role.name, permissions=role.permissions, color=role.color, hoist=role.hoist, mentionable=role.mentionable)
            except Exception: pass

@bot.event
async def on_guild_role_create(role):
    entry = await get_audit_executor(role.guild, discord.AuditLogAction.role_create)
    if entry and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
        if check_spam_action(entry.user.id, "role_create", max_count=3, seconds=10):
            member = role.guild.get_member(entry.user.id)
            if member: await strip_roles(member, f"جالس يسوي سبام إنشاء رتب بكثرة (أحدث رتبة: {role.name})")
            try: await role.delete()
            except Exception: pass

@bot.event
async def on_guild_role_update(before, after):
    entry = await get_audit_executor(after.guild, discord.AuditLogAction.role_update)
    if entry and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
        member = after.guild.get_member(entry.user.id)
        if member:
            for perm in DANGEROUS_PERMS:
                if getattr(after.permissions, perm) and not getattr(before.permissions, perm):
                    await strip_roles(member, f"حاول يفعل صلاحية خطيرة ({perm}) للرتبة ({after.name})")
                    try: await after.edit(permissions=before.permissions)
                    except Exception: pass
                    return

@bot.event
async def on_member_update(before, after):
    if len(before.roles) != len(after.roles):
        entry = await get_audit_executor(after.guild, discord.AuditLogAction.member_role_update)
        if entry and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
            added_roles = [r for r in after.roles if r not in before.roles]
            for role in added_roles:
                if any(getattr(role.permissions, perm) for perm in DANGEROUS_PERMS):
                    admin_member = after.guild.get_member(entry.user.id)
                    if admin_member:
                        await strip_roles(admin_member, f"عطى رتبة خطيرة ({role.name}) لشخص ثاني ({after.mention})")
                        try: await after.remove_roles(role)
                        except Exception: pass

# 3. حماية إدخال البوتات ورصد Mass Ban/Kick
@bot.event
async def on_member_join(member):
    if member.bot and member.id not in EXEMPTED_BOTS:
        entry = await get_audit_executor(member.guild, discord.AuditLogAction.bot_add)
        if entry and entry.user.id not in ALL_OWNERS:
            inviter = member.guild.get_member(entry.user.id)
            try:
                await member.ban(reason="دخول بوت غير مصرح به")
                if inviter:
                    await member.guild.ban(inviter, reason="إدخال بوت غير مصرح به للسيرفر")
                    await send_owner_embed(member.guild, "تبنيد بوت ومُدخله", inviter, f"دخل البوت {member.mention} للسيرفر فبندت البوت وبندت اللي دخله")
            except Exception: pass

@bot.event
async def on_member_ban(guild, user):
    entry = await get_audit_executor(guild, discord.AuditLogAction.ban)
    if entry and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
        if check_spam_action(entry.user.id, "mass_ban", max_count=3, seconds=300):
            member = guild.get_member(entry.user.id)
            if member: await strip_roles(member, "جالس يبند أعضاء بكثرة (Mass Ban)")

@bot.event
async def on_member_remove(member):
    entry = await get_audit_executor(member.guild, discord.AuditLogAction.kick)
    if entry and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
        if check_spam_action(entry.user.id, "mass_kick", max_count=3, seconds=300):
            admin_member = member.guild.get_member(entry.user.id)
            if admin_member: await strip_roles(admin_member, "جالس يطرد أعضاء بكثرة (Mass Kick)")

# 4. حماية الويب هوك وإعدادات السيرفر
@bot.event
async def on_webhooks_update(channel):
    await asyncio.sleep(0.5)
    try:
        async for entry in channel.guild.audit_logs(limit=1):
            if entry.action in [discord.AuditLogAction.webhook_create, discord.AuditLogAction.webhook_update, discord.AuditLogAction.webhook_delete]:
                now = datetime.datetime.now(datetime.timezone.utc)
                if (now - entry.created_at).total_seconds() < 5 and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
                    member = channel.guild.get_member(entry.user.id)
                    if entry.action == discord.AuditLogAction.webhook_create and entry.target:
                        try:
                            wh = await bot.fetch_webhook(entry.target.id)
                            await wh.delete(reason="حذف ويب هوك غير مصرح به")
                        except Exception: pass
                    if member:
                        await strip_roles(member, f"حاول يسوي/يعدل ويب هوك في روم {channel.mention}")
    except Exception: pass

@bot.event
async def on_guild_update(before, after):
    entry = await get_audit_executor(after, discord.AuditLogAction.guild_update)
    if entry and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
        member = after.get_member(entry.user.id)
        if member:
            await strip_roles(member, "حاول يعدل اسم أو أيقونة أو إعدادات السيرفر")
            try: await after.edit(name=before.name, icon=before.icon, banner=before.banner, description=before.description)
            except Exception: pass

@bot.event
async def on_guild_emojis_update(guild, before, after):
    if len(before) > len(after):
        entry = await get_audit_executor(guild, discord.AuditLogAction.emoji_delete)
        if entry and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
            member = guild.get_member(entry.user.id)
            if member: await strip_roles(member, "حذف إيموجيات من السيرفر")

# 5. معالجة الرسائل وروابط الدعوة والحظر عند تجاوز 400 منشن
@bot.event
async def on_message(message):
    if not message.guild:
        return

    # استثناء الأونرات والبوتات المستثناة تماماً
    if message.author.id in ALL_OWNERS or message.author.id in EXEMPTED_BOTS:
        await bot.process_commands(message)
        return

    # حساب إجمالي عدد الأشخاص والأنماط الممنشنة بالرسالة
    total_mentions = len(message.mentions) + len(message.role_mentions)
    if message.mention_everyone:
        total_mentions += message.guild.member_count

    # الحماية الوحيدة للمنشن: إذا كان المنشن فوق 400 عضو في رسالة واحدة (للبوتات والأعضاء)
    if total_mentions > 400:
        try:
            await message.delete()
        except Exception: pass
        
        if message.author.bot:
            try:
                await message.guild.kick(message.author, reason="طرد بوت بسبب منشن ضخم جداً (أكثر من 400)")
                await send_owner_embed(message.guild, "طرد بوت منشن ضخم", message.author, "البوت حاول يسوي منشن لأكثر من 400 عضو بالرسالة")
            except Exception: pass
        else:
            await strip_roles(message.author, "سوى منشن جماعي ضخم جداً (أكثر من 400 عضو)")
        return

    # حظر روابط الدعوة
    if INVITE_REGEX.search(message.content):
        try:
            await message.delete()
            await strip_roles(message.author, "نشر رابط دعوة لسيرفر ثاني بالرسائل")
            return
        except Exception: pass

    await bot.process_commands(message)

@bot.event
async def on_message_delete(message):
    if not message.guild or message.author.bot:
        return
    entry = await get_audit_executor(message.guild, discord.AuditLogAction.message_delete)
    if entry and entry.user.id not in ALL_OWNERS and entry.user.id not in EXEMPTED_BOTS:
        if check_spam_action(entry.user.id, "message_delete_spam", max_count=15, seconds=10):
            member = message.guild.get_member(entry.user.id)
            if member: await strip_roles(member, "جالس يحذف رسائل الأعضاء بكثرة (سبام حذف)")

# ==================== الأوامر الإدارية والتحكم ====================

@bot.command(name="انطم")
async def mute_all(ctx):
    if ctx.author.id not in ALL_OWNERS: return
    if ctx.author.voice and ctx.author.voice.channel:
        for member in ctx.author.voice.channel.members:
            if member.id not in ALL_OWNERS and not member.bot:
                await member.edit(mute=True)
        await ctx.send("🤫 تم كتم الجميع في الروم الصوتي.")
    else:
        await ctx.send("⚠️ يجب أن تكون داخل روم صوتي أولاً.")

@bot.command(name="تكلم")
async def unmute_all(ctx):
    if ctx.author.id not in ALL_OWNERS: return
    if ctx.author.voice and ctx.author.voice.channel:
        for member in ctx.author.voice.channel.members:
            await member.edit(mute=False)
        await ctx.send("🔊 تم فتح المايك عن الجميع.")
    else:
        await ctx.send("⚠️ يجب أن تكون داخل روم صوتي أولاً.")

@bot.command(name="فك")
async def restore_roles(ctx, member: discord.Member):
    if ctx.author.id not in ALL_OWNERS: 
        return
        
    guild_id = ctx.guild.id
    member_id = member.id
    
    if member_id in removed_roles_backup[guild_id]:
        bot_top_role = ctx.guild.me.top_role
        saved_roles = removed_roles_backup[guild_id][member_id]
        roles_to_add = [r for r in saved_roles if r in ctx.guild.roles and r.position < bot_top_role.position]
        
        if roles_to_add:
            try:
                await member.add_roles(*roles_to_add, reason="إعادة الرتب بواسطة الأونر")
                del removed_roles_backup[guild_id][member_id]
                await ctx.send(f"✅ تم إعادة الرتب بنجاح للعضو: {member.mention}")
            except Exception:
                await ctx.send("❌ حدث خطأ، تأكد من صلاحيات وترتيب رتبة البوت.")
        else:
            await ctx.send("⚠️ لا توجد رتب صالحة للإعادة.")
    else:
        await ctx.send("⚠️ لا توجد رتب محفوظة لهذا العضو.")

# --- تشغيل البوت ---
BOT_TOKEN = os.environ.get("DISCORD_TOKEN")
if BOT_TOKEN:
    bot.run(BOT_TOKEN)
else:
    print("خطأ: لم يتم العثور على متغير البيئة DISCORD_TOKEN")
