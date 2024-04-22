import { Composer, Markup, Scenes } from 'telegraf'
import { parse } from 'csv-parse/sync'
import {
  exportTransactions,
  exportTransactionTemplate,
  getAllBalances,
  purchaseItemForMember,
} from '../transactions.js'
import { createCsv, formatTransaction } from '../utils.js'
import { config } from '../config.js'
import { ContextWithScenes } from './scene.js'

//#region Misc

const bot = new Composer<ContextWithScenes>()

const account_details = {
  number: 'FI35 7997 7991 8699 54',
  name: 'Understödsföreningen för Teknologisk verksamhet rf',
  ref: '20239',
}
const formattedAccountString =
  `<pre>Mottagare:${account_details.name}\n` +
  `Kontonummer: ${account_details.number}\n` +
  `Reference nummer: ${account_details.ref}\n` +
  '</pre>'

//endregion

//#region Export

const exportCommand = bot.command('exportera', async (ctx) => {
  const res = await exportTransactions()
  const csv = createCsv(res)
  ctx.replyWithDocument({
    source: Buffer.from(csv, 'utf-8'),
    filename: `spiken-dump-${new Date().toISOString()}.csv`,
  })
})

//endregion

//#region Historia all

const allHistoryCommand = bot.command('historia_all', async (ctx) => {
  const history = await exportTransactions()

  const historyString =
    '```' +
    history.rows
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .map((row) =>
        formatTransaction(
          row.user_name,
          row.description,
          row.amount_cents,
          row.created_at
        )
      )
      .join('') +
    '```'

  return ctx.reply(historyString, { parse_mode: 'Markdown' })
})

//endregion

//#region Saldo all

const allSaldoCommand = bot.command('saldo_all', async (ctx) => {
  const balances = (await getAllBalances()).sort(
    (a, b) => b.balance - a.balance
  )

  const historyString =
    `User saldos:<pre>` +
    balances.map((b) => `${b.userName}: ${b.balance}`).join('\n') +
    '</pre>'

  return ctx.reply(historyString, { parse_mode: 'HTML' })
})

//endregion

//#region Manual saldo update
const saldoTemplateCommand = bot.command('saldo_template', async (ctx) => {
  const csv = createCsv(await exportTransactionTemplate())
  ctx.replyWithDocument({
    source: Buffer.from(csv, 'utf-8'),
    filename: `saldo-template-${new Date().toISOString()}.csv`,
  })
})

const saldoUploadScene = new Scenes.WizardScene<ContextWithScenes>(
  'saldo_upload_scene',
  async (ctx) => {
    ctx.reply(
      `Skicka en csv fil med transaktioner du vill lägga till.
Laddningen kan avbrytas med /exit.
En csv template för transaktioner kan skapas med /saldo_template.

Saldo templaten kan antingen editeras rakt i en text editor eller importeras till Excel (eller motsvarande).
Ifall excel används, se till att exportera med "," eller ";" som delimiter.

Från templaten behöver endast kolumnerna "amount_cents" och "description" ändras.
En transaktion skapas för varje rad i csv-filen, ta alltså bort rader där summan hålls som 0.

"amount_cents" är storleken på transaktionen i cent.
Observera att en inbetalning ska ha ett positiv tal och att en kostnad ska ha ett negativt tal!

Ifall någon person saknas från csv templaten kan user ID:s hittas genom att öppna en chat med personen i telegram web.
Siffran i slutet av URLen (efter #) är user ID:n.
ID:n kan vara positiv eller negativ, ta alltså också med "-" från URL:en om ett sånt finns.
User ID:n fungerar som primary key, kom alltså ihåg att ändra den om du manuellt lägger till fler rader till csv:n!
`
    )
    return ctx.wizard.next()
  },
  async (ctx) => {
    if (ctx.message !== undefined && 'document' in ctx.message) {
      const document = ctx.message.document
      if (document.mime_type !== 'text/csv') {
        return ctx.reply('Botten tar bara emot csv-filer.')
      }

      const { file_path } = await ctx.telegram.getFile(document.file_id)

      if (file_path === undefined) {
        return ctx.reply('Filen kunde inte laddas.')
      }

      const res = await fetch(
        `https://api.telegram.org/file/bot${config.botToken}/${file_path}`
      )
      const fileContent = await res.text()

      if (!fileContent.includes(';') && !fileContent.includes(',')) {
        return ctx.reply(
          'Filen du laddade upp hade fel format. Delimitern bör vara ";" eller ","'
        )
      }

      const delimiter = fileContent.includes(';') ? ';' : ','
      const parsedContent = parse(fileContent, {
        delimiter,
        from: 1,
      }) as string[][]

      // Ensure that the csv file contains the correct headers
      const headers = parsedContent.shift()
      if (
        headers?.length !== 4 ||
        headers[0] !== 'user_id' ||
        headers[1] !== 'user_name' ||
        headers[2] !== 'description' ||
        headers[3] !== 'amount_cents'
      ) {
        return ctx.reply(
          'Filen du laddade upp hade fel format. Filens kolumner bör vara "user_id, user_name, description, amount_cents" '
        )
      }

      try {
        ctx.scene.session.transactions = parsedContent.map((row) => {
          return {
            userId: Number(row[0]),
            userName: row[1],
            description: row[2],
            amountCents: row[3],
          }
        })
      } catch (error) {
        console.log('Error loading transactions:', error)
        ctx.reply(
          `Något gick fel när dokumentet laddades. Inga transaktioner har lagts till.
    ${error}`
        )
      }

      const transactions = ctx.scene.session.transactions
      transactions.forEach(
        (t) => (t.description = `Manuell transaktion: ${t.description}`)
      )

      const confirmationMessage =
        'Följande transaktioner kommer läggas till:\n```' +
        transactions
          .map((t) =>
            formatTransaction(t.userName, t.description, Number(t.amountCents))
          )
          .join('') +
        '```'
      ctx.reply(confirmationMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.callback('Godkänn', 'confirm'),
          Markup.button.callback('Avbryt', 'abort'),
        ]),
      })
    }
    return ctx.wizard.next()
  },
  async (ctx) => {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      if (ctx.callbackQuery.data === 'confirm') {
        const transactions = ctx.scene.session.transactions
        for (const t of transactions) {
          await purchaseItemForMember(t)
        }
        ctx.scene.leave()
        return ctx.reply(`Saldoladdningen lyckades med en insättning av ${transactions.length} nya transaktioner.
Använd /historia_all eller /exportera för att inspektera de nya transaktionerna.`)
      } else {
        ctx.scene.leave()
        return ctx.reply('Saldoladdningen avbröts')
      }
    }
  }
)

saldoUploadScene.command('exit', async (ctx) => {
  ctx.reply('Saldouppladningen avbröts')
  return ctx.scene.leave()
})

const stage = new Scenes.Stage([saldoUploadScene])
bot.use(stage.middleware())

const saldoUploadCommand = bot.command('saldo_upload', async (ctx) => {
  await ctx.scene.enter('saldo_upload_scene')
})

//endregion

//#region Shame

/**
 * The command sends a message to each user that has a saldo lower than the cut-off with a default cut-off of 0.
 * I.e sending `/shame` will send a message to all users with negative score,
 * while ending `shame_20` will send a message to all users with a balance of less than -20.
 */
const shameCommand = bot.hears(/^\/shame(?:_(\d+))?$/, async (ctx) => {
  const saldoCutOff = ctx.match[1] ? Number(ctx.match[1]) : 0

  const balances = (await getAllBalances()).filter(
    (obj) => obj.balance < -saldoCutOff
  )

  for await (const { userId, balance } of balances) {
    const message =
      `Ert saldo är nu <b>${balance.toFixed(
        2
      )}€</b>. Det skulle vara att föredra att Ert saldo hålls positivt. ` +
      `Ni kan betala in på Er spik genom att skicka en summa, dock helst minst ${balance.toFixed(
        2
      )}, till följande konto: ` +
      formattedAccountString
    await ctx.telegram.sendMessage(userId, message, {
      parse_mode: 'HTML',
    })
  }

  if (balances.length > 0) {
    const adminMessage =
      `The following users were pinged with a cut-off of -${saldoCutOff}€:<pre>` +
      balances.map((b) => `${b.userName}: ${b.balance}`).join('\n') +
      '</pre>'
    ctx.telegram.sendMessage(config.adminChatId, adminMessage, {
      parse_mode: 'HTML',
    })
  }
})

//endregion

export default bot
