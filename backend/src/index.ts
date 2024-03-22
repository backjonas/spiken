import { Context, Markup, Telegraf, session } from 'telegraf'
import { config } from './config.js'
import {
  exportTransactionsForOneUser,
  getBalanceForMember,
  purchaseItemForMember,
} from './transactions.js'
import { Message, Update } from '@telegraf/types'
import { formatDateToString, centsToEuroString } from './utils.js'
import adminCommands from './admin/index.js'
import { deleteProduct, getProducts } from './products.js'
import { MyContext, stage } from './product_handling.js'

/*
Toiveiden tynnyri:
- Admin interface, lägg till/ta bort produkter, lägg till/ta bort saldo
- Skamlistan, posta alla med negativt i chatten med en @
- En 'vapaa myynti' command med description och summa
- "Undo" funktionalitet
- Transaktionshistorik för användare
*/

const bot = new Telegraf<MyContext>(config.botToken)

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
bot.use(stage.middleware())

//--------------------------------------------------------------------------------------------------------------------
interface ProductObj {
  command: string
  description: string
  priceCents: string
}

const productsToArray = async (): Promise<ProductObj[]> => {
  const productQuery = getProducts()
  const res: ProductObj[] = (await productQuery).rows.map(
    ({ name, description, price_cents }) => {
      return {
        command: name,
        description,
        priceCents: price_cents,
      }
    }
  )
  return res
}

const products = await productsToArray()

bot.command('delete_product', (ctx) => {
  const priceList = products.map(({ description, priceCents }) => {
    return `\n${description} - ${Number(priceCents) / -100}€`
  })
  const keyboard_array = formatButtonArray(
    products.map(({ command, description }) => {
      return Markup.button.callback(
        description,
        `delete_productname_${command}`
      )
    })
  )

  return ctx.reply(`Vilken produkt vill du ta bort ${priceList}`, {
    ...Markup.inlineKeyboard(keyboard_array),
  })
})

bot.action(/delete_productname_(.*)/, async (ctx) => {
  const productName = ctx.match[1]
  try {
    await deleteProduct(productName)
    return ctx.editMessageText(`Raderingen av product ${productName} lyckades!`)
  } catch (e) {
    console.log('Failed to remove product:', e)
    return ctx.editMessageText(
      `Raderingen av product ${productName} misslyckades! Klaga till nån!`
    )
  }
})

bot.command('add_product', async (ctx) => {await ctx.scene.enter('add_product_scene')})
//--------------------------------------------------------------------------------------------------------------------

console.log(products)

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

products.forEach(({ command, description, priceCents }) => {
  bot.command(command, addPurchaseOption(description, priceCents))
})

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
  const priceList = products.map(({ description, priceCents }) => {
    return `\n${description} - ${Number(priceCents) / -100}€`
  })
  const keyboard_array = formatButtonArray(
    products.map(({ command, description }) => {
      return Markup.button.callback(description, command)
    })
  )

  return ctx.reply(`Vad vill du köpa? Produkternas pris: ${priceList}`, {
    ...Markup.inlineKeyboard(keyboard_array),
  })
})

products.forEach(({ command, description, priceCents }) => {
  bot.action(command, addPurchaseOptionFromInline(description, priceCents))
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

  const parsedHistory = history.rows.map(
    ({ created_at, description, amount_cents }) => {
      return {
        created_at,
        description,
        amount_cents,
      }
    }
  )
  const saldo = await getBalanceForMember(ctx.from.id)
  var res = `Ditt nuvarande saldo är ${saldo}. Här är din historia:\`\`\``
  parsedHistory.forEach((row) => {
    res +=
      `\n${formatDateToString(
        row.created_at
      )} ${row.created_at.toLocaleTimeString('sv-fi')}, ` +
      `${centsToEuroString(-row.amount_cents)}, ` +
      `${row.description}`
  })
  res += '```'
  return ctx.reply(res, { parse_mode: 'Markdown' })
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
  { command: 'meny', description: 'Tar upp köp menyn för alla produkter' },
  { command: 'historia', description: 'Se din egna transaktionshistorik' },
])

// Admin middleware is used for all commands added after this line!
bot.use(adminCommands)

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
 * Splits a array into an array of arrays with max n elements per subarray
 *
 * n defaults to 3
 */
function formatButtonArray(array: any[], n: number = 3): any[][] {
  const result = []
  for (let i = 0; i < array.length; i += n) {
    result.push(array.slice(i, i + n))
  }
  return result
}
