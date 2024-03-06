import { Context, Telegraf } from 'telegraf'
import Table from 'cli-table'
import { config } from './config.js'
import {
  exportTransactions,
  exportTransactionsForOneUser,
  getBalanceForMember,
  purchaseItemForMember,
  Transaction
} from './transactions.js'
import { Message, Update } from '@telegraf/types'

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

interface Command {
  command: string
  description: string
  priceCents: string
}

const commands: Command[] = [
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
commands.forEach(({ command, description, priceCents }) => {
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

interface HistoryRow {
  created_at: Date;
  description: string;
  amount_cents: number;
  cumulative_sum: number;
}

bot.command('historia', async (ctx) => {
  const history = await exportTransactionsForOneUser(ctx.from.id)
  console.log(history)
  const parsed_history = history.rows.map(({created_at, description, amount_cents, cumulative_sum}) => {
    const new_row: HistoryRow = {
      created_at,
      description,
      amount_cents,
      cumulative_sum
    }
    return new_row;
})

  const formated_history =  new Table({
    head: ['Tid', 'Produkt', 'Pris', 'Saldo efter transaktionen']
  });

  parsed_history.forEach(row => {
    formated_history.push([
      `${row.created_at.toLocaleDateString('sv-fi')} ${row.created_at.toLocaleTimeString('sv-fi')}`,
      row.description,
      cents_to_euro_string(row.amount_cents),
      cents_to_euro_string(row.cumulative_sum)
    ]);
  });

  const res = `Ditt nuvarande saldo är ${cents_to_euro_string(parsed_history[parsed_history.length -1].cumulative_sum)}.Här är din historia:
  \`\`\`${formated_history.toString()}\`\`\``

  return ctx.reply(res, {parse_mode: "Markdown"})
})

// Checka de här att de fungerar ännu
bot.command('exportera', async (ctx) => {
  if (!await is_admin_user(ctx)) {
    return ctx.reply('sii dej i reven, pleb!')
  }
  const res = await exportTransactions()
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
  ...commands.map(({ command, description, priceCents }) => ({
    command,
    description: `Köp 1 st ${description} för ${(
      Number(priceCents) / -100
    ).toFixed(2)}€`,
  })),
  { command: 'saldo', description: 'Kontrollera saldo' },
  { command: 'info', description: 'Visar information om bottens användning' },
  { command: 'historia', description: 'Se din egna transaktionshistorik'}
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

function cents_to_euro_string(cents: number): string {
  return ( cents / -100).toString() + "€"
}

/**
 * Checks if the user is in the admin chat
 * @param ctx 
 * @returns 
 */
async function is_admin_user(ctx: Context<{ message: Update.New & Update.NonChannel & Message.TextMessage; update_id: number }> & Omit<Context<Update>, keyof Context<Update>>) {
  return await isChatMember(ctx.from.id, config.adminChatId)
}

