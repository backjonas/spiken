//#region Imports & Init
import { Context, Markup, Telegraf, session, Scenes } from 'telegraf'
import { config } from './config.js'
import {
  TransactionInsert,
  exportTransactionsForOneUser,
  getBalanceForMember,
  purchaseItemForMember,
} from './transactions.js'
import { Message, Update } from '@telegraf/types'
import adminCommands from './admin/index.js'
import { productsToArray } from './admin/product.js'
import { ContextWithScenes } from './scene.js'
import productCommands from './admin/product.js'
import {
  centsToEuroString as formatCentsToEuroString,
  confirmOrAbortButton,
  formatButtonArray,
  formatDateToString,
  formatName,
} from './utils.js'

/*
Toiveiden tynnyri:
- En 'vapaa myynti' command med description och summa
*/

const bot = new Telegraf<ContextWithScenes>(config.botToken)

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

bot.use(session())
// addAdminCommands(bot)

// bot.use(admin middleware)
// bot.command...
bot.use(productCommands)
//endregion

//#region Products
const products = await productsToArray()
//endregion

//#region Buying from commands
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

products.forEach(({ name, description, price_cents }) => {
  bot.command(name, addPurchaseOption(description, price_cents))
})

//endregion

//#region Buying inline

const addPurchaseOptionFromInline = (
  itemDescription: string,
  itemPriceCents: string
) => {
  return async (ctx: Context<Update.CallbackQueryUpdate>) => {
    if (ctx.from === undefined) {
      return ctx.editMessageText('Köpet misslyckades, klaga till croupieren.')
    }
    try {
      await purchaseItemForMember({
        userId: ctx.from.id,
        userName: formatName({ ...ctx.from }),
        description: itemDescription,
        amountCents: itemPriceCents,
      })
    } catch (e) {
      console.log('Failed to purchase item:', e)
      return ctx.editMessageText('Köpet misslyckades, klaga till croupieren')
    }
    try {
      const balance = await getBalanceForMember(ctx.from.id)
      ctx.answerCbQuery()
      return ctx.editMessageText(
        `Köpet av ${itemDescription} för ${
          Number(itemPriceCents) / -100
        }€ lyckades! Ditt saldo är nu ${balance}€`
      )
    } catch (e) {
      ctx.answerCbQuery()
      console.log('Failed to get balance:', e)
      return ctx.editMessageText(
        'Köpet lyckades, men kunde inte hämta saldo. Klaga till croupieren'
      )
    }
  }
}

bot.command('meny', async (ctx) => {
  const products = await productsToArray()
  const priceList = products.map(({ description, price_cents }) => {
    return `\n${description} - ${Number(price_cents) / -100}€`
  })
  const keyboard_array = formatButtonArray(
    products.map(({ name, description }) => {
      return Markup.button.callback(description, name)
    })
  )

  return ctx.reply(`Vad vill du köpa? Produkternas pris: ${priceList}`, {
    ...Markup.inlineKeyboard(keyboard_array),
  })
})

products.forEach(({ name, description, price_cents }) => {
  bot.action(name, addPurchaseOptionFromInline(description, price_cents))
})

//endregion

//#region History

bot.command('historia', async (ctx) => {
  const history = await exportTransactionsForOneUser(ctx.from.id, 30)

  const parsedHistory = history.rows
    .map(({ created_at, description, amount_cents }) => {
      return {
        created_at,
        description,
        amount_cents,
      }
    })
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())

  const saldo = await getBalanceForMember(ctx.from.id)
  var res = `Ditt nuvarande saldo är ${saldo}. Här är din historia:\`\`\``
  parsedHistory.forEach((row) => {
    res +=
      `\n${formatDateToString(row.created_at, true)}, ` +
      `${formatCentsToEuroString(-row.amount_cents)}, ` +
      `${row.description}`
  })
  res += '```'
  return ctx.reply(res, { parse_mode: 'Markdown' })
})

//endregion

//#region Undo

bot.command('undo', async (ctx) => {
  const queryResult = await exportTransactionsForOneUser(ctx.from.id, 1)
  const latestTransaction = queryResult.rows[0]

  const description = latestTransaction.description
  if (
    description.endsWith('_undo') ||
    description.startsWith('Manuell transaktion: ')
  ) {
    return ctx.reply('Din senaste händelse är redan ångrad')
  }

  if (latestTransaction.amount_cents > 0) {
    return ctx.reply('Du kan inte ångra en insättning')
  }

  try {
    const productUndone = {
      userId: latestTransaction.user_id,
      userName: latestTransaction.user_name,
      description: latestTransaction.description + '_undo',
      amountCents: String(-latestTransaction.amount_cents),
    } as TransactionInsert
    await purchaseItemForMember(productUndone)

    const message =
      'Följande transaktion har ångrats: \n' +
      `\t\tTid: ${formatDateToString(latestTransaction.created_at, true)}\n` +
      `\t\tProdukt: ${latestTransaction.description}\n` +
      `\t\tPris: ${formatCentsToEuroString(latestTransaction.amount_cents)}`

    ctx.reply(message)
    console.log(
      `User id ${ctx.from.id} undid transaction id ${latestTransaction.id}`
    )
  } catch (e) {
    ctx.reply('Kunde inte ångra din senaste transaktion, kontakta Cropieren')
    console.log(
      `User id ${ctx.from.id} tried to undo a transaction and faced the following problem error: ${e}`
    )
  }
})

//endregion

//#region Custom buy
const buyOtherScene = new Scenes.WizardScene<ContextWithScenes>(
  'buy_other_scene',
  async (ctx) => {
    ctx.reply('Vad är de du vill köpa?')
    ctx.scene.session.customBuy = {
      description: '',
      priceCents: '',
    }
    return ctx.wizard.next()
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.customBuy.description = ctx.message.text
      ctx.reply('Produktens pris (i positiva cent)?')
      return ctx.wizard.next()
    } else {
      ctx.reply('Du måst skriva en text')
    }
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      try {
        if (isNaN(Number(ctx.message.text)) || Number(ctx.message.text) < 0) {
          return ctx.reply(
            'Priset måste vara ett positivt tal, det läggs sedan in i databasen som negativt!'
          )
        }
        ctx.scene.session.customBuy.priceCents = `-` + ctx.message.text

        const customBuy = ctx.scene.session.customBuy
        confirmOrAbortReplyForCustomBuy(ctx, customBuy)
        console.log(ctx.scene.session.customBuy)
        return ctx.wizard.next()
      } catch (e) {
        console.log('Error found: ', e)
      }
    }
  },
  async (ctx) => {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      ctx.editMessageReplyMarkup(undefined)
      const decision = ctx.callbackQuery.data
      if (decision === 'confirm') {
        try {
          const customBuy = ctx.scene.session.customBuy
          await purchaseItemForMember({
            userId: ctx.from!.id,
            userName: formatName({ ...ctx.from! }),
            description: customBuy.description,
            amountCents: customBuy.priceCents,
          })
        } catch (e) {
          console.log('Failed to purchase item:', e)
          ctx.reply('Köpet misslyckades, klaga till croupieren')
        }
        try {
          const balance = await getBalanceForMember(ctx.from!.id)
          ctx.reply(`Köpet lyckades! Ditt saldo är nu ${balance}€`)
        } catch (e) {
          console.log('Failed to get balance:', e)
          ctx.reply(
            'Köpet lyckades, men kunde inte hämta saldo. Klaga till croupieren'
          )
        }
        return ctx.scene.leave()
      } else if (decision === 'abort') {
        ctx.reply('Köpet avbrutet.')
        return ctx.scene.leave()
      }
    } else {
      ctx.reply('Du måst trycka på endera alternativ')
    }
  }
)

function confirmOrAbortReplyForCustomBuy(
  ctx: ContextWithScenes,
  customBuy: {
    description: string
    priceCents: string
  }
) {
  ctx.reply(
    `Följande inköp kommer att läggas till åt Er:\n` +
      `\t\t\tVad: ${customBuy.description}\n` +
      `\t\t\tPris: ${formatCentsToEuroString(-customBuy.priceCents)}\n`,
    {
      ...confirmOrAbortButton,
    }
  )
}

const stage = new Scenes.Stage([buyOtherScene])
bot.use(stage.middleware())

const buyOtherCommand = bot.command('kop_ovrigt', async (ctx) => {
  await ctx.scene.enter('buy_other_scene')
})

//endregion

//#region Misc commands

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

bot.telegram.setMyCommands([
  ...products.map(({ name, description, price_cents }) => ({
    command: name,
    description: `Köp 1 st ${description} för ${(
      Number(price_cents) / -100
    ).toFixed(2)}€`,
  })),
  { command: 'meny', description: 'Tar upp köp menyn för alla produkter' },
  {
    command: 'kop_ovrigt',
    description: 'Köp något som inte finns bland nuvarande producter',
  },
  { command: 'saldo', description: 'Kontrollera saldo' },
  { command: 'historia', description: 'Se din egna transaktionshistorik' },
  { command: 'undo', description: 'Ångra ditt senaste köp' },
  { command: 'info', description: 'Visar information om bottens användning' },
])

// Admin middleware is used for all commands added after this line!
bot.use(adminCommands)

//endregion

//#region Launch bot & misc

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

export const isChatMember = async (userId: number, chatId: number) => {
  const acceptedStatuses = ['creator', 'administrator', 'member', 'owner']
  try {
    const member = await bot.telegram.getChatMember(chatId, userId)
    return acceptedStatuses.includes(member.status)
  } catch (e) {
    console.log('Error checking group membership:', e)
    return false
  }
}

//endregion
