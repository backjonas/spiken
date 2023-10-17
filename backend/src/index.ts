import { Telegraf } from 'telegraf'
import { config } from './config.js'
import { getBalanceForMember, purchaseItemForMember } from './transactions.js'

const bot = new Telegraf(config.botToken)
bot.command('patron', async (ctx) => {
  if (!(await isChatMember(ctx.from.id))) {
    return ctx.reply('sii dej i reven!')
  }

  try {
    await purchaseItemForMember({
      userId: ctx.from.id,
      userName: formatName({ ...ctx.from }),
      description: 'Patron',
      amountCents: '-1200',
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
