import { Context, Telegraf } from 'telegraf'
import { config } from './config.js'
import { getBalanceForMember, purchaseItemForMember } from './transactions.js'
import { Message, Update } from '@telegraf/types'

const bot = new Telegraf(config.botToken)

bot.use(async (ctx, next) => {
  if (!ctx.from) {
    return
  }
  if (!(await isChatMember(ctx.from.id))) {
    return ctx.reply('sii dej i reven!')
  }
  await next()
})

const addPurchaseOption = (itemDescription: string, itemPriceCents: string) => {
  return async (
    ctx: Context<{
      message: Update.New & Update.NonChannel & Message.TextMessage
      update_id: number
    }>
  ) => {
    try {
      await purchaseItemForMember({
        userId: ctx.from.id,
        userName: formatName({ ...ctx.from }),
        description: itemDescription,
        amountCents: itemPriceCents,
      })
    } catch (e) {
      console.log('Failed to purchase item:', e)
      return ctx.reply('Köpet misslyckades, klaga till croupieren')
    }
    try {
      const balance = await getBalanceForMember(ctx.from.id)
      return ctx.reply(`Köpet lyckades! Ditt saldo är nu ${balance}€`)
    } catch (e) {
      console.log('Failed to get balance:', e)
      return ctx.reply(
        'Köpet lyckades, men kunde inte hämta saldo. Klaga till croupieren'
      )
    }
  }
}

bot.command('patron', addPurchaseOption('Patron', '-1200'))
bot.command('kalja', addPurchaseOption('Öl', '-150'))
bot.command('cigarr', addPurchaseOption('Cigarr', '-1000'))
bot.command('cognac', addPurchaseOption('Cognac', '-200'))

bot.command('saldo', async (ctx) => {})

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

const isChatMember = async (userId: number) => {
  const acceptedStatuses = ['creator', 'administrator', 'member', 'owner']
  const member = await bot.telegram.getChatMember(config.chatId, userId)
  return acceptedStatuses.includes(member.status)
}

const formatName = ({
  first_name,
  last_name,
  username,
}: {
  first_name: string
  last_name?: string
  username?: string
}) => {
  const formattedLastName = last_name ? ` ${last_name}` : ``
  const formattedUserName = username ? ` (${username})` : ``
  return `${first_name}${formattedLastName}${formattedUserName}`
}
