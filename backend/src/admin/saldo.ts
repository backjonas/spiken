import { Composer } from 'telegraf'
import { isChatMember } from '../index.js'
import {
  exportTransactions,
  exportTransactionTemplate,
} from '../transactions.js'
import { createCsv, formatDateToString, centsToEuroString } from '../utils.js'
import { config } from '../config.js'

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

export default Composer.compose([
  exportCommand,
  allHistoryCommand,
  saldoTemplateCommand,
])
