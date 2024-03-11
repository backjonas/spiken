import { Context, Telegraf } from 'telegraf'
import { config } from './config.js'
import {
  exportTransactions,
  exportTransactionsForOneUser,
  getBalanceForMember,
  purchaseItemForMember,
} from './transactions.js'
import { Message, Update } from '@telegraf/types'
import { QueryResult } from 'pg'

/*
Toiveiden tynnyri:
- Admin interface, lägg till/ta bort produkter, lägg till/ta bort saldo
- Skamlistan, posta alla med negativt i chatten med en @
- En 'vapaa myynti' command med description och summa
- "Undo" funktionalitet
- Transaktionshistorik för användare
*/

const bot = new Telegraf(config.botToken)

const info_message = `Hej, välkommen till STF spik bot!
  Här kan du köra köp och kolla ditt saldo.
  Du hittar alla commandon under "Menu" med beskrivning.
  Märk att du inte kan ångra ett köp, så var aktsam!
  Ifall något underligt sker ska du vara i kontakt med Croupiären!\n
  Oss väl och ingen illa!`

bot.use(async (ctx, next) => {
  if (!ctx.from) {
    return
  }
  if (!(await isChatMember(ctx.from.id, config.chatId))) {
    return ctx.reply('sii dej i reven!')
  }
  await next()
})

bot.use(async (ctx, next) => {
  if (ctx.chat?.type !== 'private') {
    return
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


const products: {
  command: string
  description: string
  priceCents: string
  }[] = [
  {
    command: 'patron',
    description: 'Patron',
    priceCents: '-1200',
  },
  {
    command: 'kalja',
    description: 'Öl',
    priceCents: '-150',
  },
  {
    command: 'cigarr',
    description: 'Cigarr',
    priceCents: '-600',
  },
  {
    command: 'cognac',
    description: 'Cognac',
    priceCents: '-200',
  },
  {
    command: 'snaps',
    description: 'Snaps',
    priceCents: '-200',
  }
]
products.forEach(({ command, description, priceCents }) => {
  bot.command(command, addPurchaseOption(description, priceCents))
})

bot.command('saldo', async (ctx) => {
  const balance = await getBalanceForMember(ctx.from.id)
  return ctx.reply(`Ditt saldo är ${balance}€`)
})

bot.command('info', async (ctx) => {
  return ctx.reply(info_message)
})

bot.command('start', async (ctx) => {
  return ctx.reply(info_message)
})

bot.command('historia', async (ctx) => {
  const history = await exportTransactionsForOneUser(ctx.from.id)

  const parsedHistory = history.rows.map(({created_at, description, amount_cents}) => {
    return {
      created_at,
      description,
      amount_cents
    }
})
  const saldo = await getBalanceForMember(ctx.from.id)
  var res = `Ditt nuvarande saldo är ${saldo}. Här är din historia:\`\`\``
  parsedHistory.forEach(row => {
    res +=  `\n${formatDateToString(row.created_at)} ${row.created_at.toLocaleTimeString('sv-fi')}, `+
    `${cents_to_euro_string(-row.amount_cents)}, `+
    `${row.description}`
  })
  res += "\`\`\`"
  return ctx.reply(res, {parse_mode: "Markdown"})
})

bot.command('historia_all', async (ctx) => {
  if (!await isAdminUser(ctx)) {
    return ctx.reply('Nå huhhu, håll dig ti ditt egna dåkande!')
  }
  const history = await exportTransactions()

  const parsedHistory = history.rows.map(({user_name , created_at, description, amount_cents}) => {
    return {
      user_name,
      created_at,
      description,
      amount_cents
    }
})

  var res = `\`\`\``
  parsedHistory.forEach(row => {
    res +=  `\n${row.user_name.split(" ").slice(0,-1).join(" ")}, ` +
    `${formatDateToString(row.created_at)} ${row.created_at.toLocaleTimeString('sv-fi')}, `+
    `${cents_to_euro_string(-row.amount_cents)}, `+
    `${row.description}`
  })
  res += "\`\`\`"
  return ctx.reply(res, {parse_mode: "Markdown"})
})

bot.command('exportera', async (ctx) => {
  if (!await isAdminUser(ctx)) {
    return ctx.reply('sii dej i reven, pleb!')
  }
  // Temp solution until I or Bäck fixes the error this produces
  const res: QueryResult<any> = await exportTransactions()
  const headers = res.fields.map((field) => field.name)
  const rows = res.rows.map((row) => {
    return headers
      .map((header) => {
        return (String(row[header]) ?? '').replace(',', '')
      })
      .join(', ')
  })
  const csv = `${headers.join(', ')}
  ${rows.join('\n')}`
  ctx.replyWithDocument({
    source: Buffer.from(csv, 'utf-8'),
    filename: `spiken-dump-${new Date().toISOString()}.csv`,
  })
})

bot.telegram.setMyCommands([
  ...products.map(({ command, description, priceCents }) => ({
    command,
    description: `Köp 1 st ${description} för ${(
      Number(priceCents) / -100
    ).toFixed(2)}€`,
  })),
  { command: 'saldo', description: 'Kontrollera saldo' },
  { command: 'info', description: 'Visar information om bottens användning' },
  { command: 'historia', description: 'Se din egna transaktionshistorik' }
])

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

const isChatMember = async (userId: number, chatId: number) => {
  const acceptedStatuses = ['creator', 'administrator', 'member', 'owner']
  try {
    const member = await bot.telegram.getChatMember(chatId, userId)
    return acceptedStatuses.includes(member.status)
  } catch (e) {
    console.log('Error checking group membership:', e)
    return false
  }
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
/**
 * Formats from number of cent to a string in euro. I.e. -350 becomes "-3.5€"
 * @param amountInCents 
 * @returns 
 */
function cents_to_euro_string(amountInCents: number): string {
  var euro = (amountInCents / -100).toFixed(2).toString()
  if (euro[0] !== '-') {
    euro = " " + euro
  }
  return euro + "€"
}

/**
 * Checks if the user is in the admin chat
 * @param ctx 
 * @returns 
 */
const isAdminUser = async (ctx: Context<{ message: Update.New & Update.NonChannel & Message.TextMessage; update_id: number }> & Omit<Context<Update>, keyof Context<Update>>) =>  {
  const res: Promise<boolean> = isChatMember(ctx.from.id, config.adminChatId)
  return res 
}
function formatDateToString(date: Date){
 return `${date.toLocaleDateString('sv-fi', {year: '2-digit', month: '2-digit', day: '2-digit'})} ${date.toLocaleDateString('sv-fi', {weekday: 'short'})}`;
}

