import { Telegraf } from 'telegraf'
import { config } from './config.js'

const bot = new Telegraf(config.botToken)
bot.command('patron', async (ctx) => {
  if (!(await isChatMember(ctx.from.id))) {
    return ctx.reply('sii dej i reven!')
  }
  return ctx.reply('Hello')
})
bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

const isChatMember = async (userId: number) => {
  const acceptedStatuses = ['creator', 'administrator', 'member', 'owner']
  const member = await bot.telegram.getChatMember(config.chatId, userId)
  return acceptedStatuses.includes(member.status)
}
