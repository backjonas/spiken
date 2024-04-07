import { Composer } from 'telegraf'
import { parse } from 'csv-parse/sync'
import {
  exportTransactions,
  exportTransactionTemplate,
  purchaseItemForMember,
} from '../transactions.js'
import { createCsv, formatDateToString, centsToEuroString } from '../utils.js'
import { config } from '../config.js'
import { TransactionInsert } from '../transactions.js'

const bot = new Composer()

const exportCommand = bot.command('exportera', async (ctx) => {
  const res = await exportTransactions()
  const csv = createCsv(res)
  ctx.replyWithDocument({
    source: Buffer.from(csv, 'utf-8'),
    filename: `spiken-dump-${new Date().toISOString()}.csv`,
  })
})

const allHistoryCommand = bot.command('historia_all', async (ctx) => {
  const history = await exportTransactions()

  const parsedHistory = history.rows.map(
    ({ user_name, created_at, description, amount_cents }) => {
      return {
        user_name,
        created_at,
        description,
        amount_cents,
      }
    }
  )

  var res = `\`\`\``
  parsedHistory.forEach((row) => {
    res +=
      `\n${row.user_name.split(' ').slice(0, -1).join(' ')}, ` +
      `${formatDateToString(row.created_at, true)}, ` +
      `${centsToEuroString(-row.amount_cents)}, ` +
      `${row.description}`
  })
  res += '```'
  return ctx.reply(res, { parse_mode: 'Markdown' })
})

const saldoTemplateCommand = bot.command('saldo_template', async (ctx) => {
  const csv = createCsv(await exportTransactionTemplate())
  ctx.replyWithDocument({
    source: Buffer.from(csv, 'utf-8'),
    filename: `saldo-template-${new Date().toISOString()}.csv`,
  })
})

const saldoUploadCommand = bot.on('document', async (ctx) => {
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

  const transactions: TransactionInsert[] = []
  try {
    transactions.concat(
      parsedContent.map((row) => {
        return {
          userId: Number(row[0]),
          userName: row[1],
          description: row[2],
          amountCents: row[3],
        }
      })
    )
  } catch (error) {
    console.log('Error loading transactions:', error)
    ctx.reply(
      `Något gick fel när dokumentet laddades. Inga transaktioner har lagts till.
${error}`
    )
  }
  transactions.forEach((transaction) => purchaseItemForMember(transaction))
  ctx.reply(`Saldoladdningen lyckades med en insättning av ${transactions.length} nya transaktioner.
Använd /historia_all eller /exportera för att inspektera de nya transaktionerna.`)
})

export default Composer.compose([
  exportCommand,
  allHistoryCommand,
  saldoTemplateCommand,
  saldoUploadCommand,
])
