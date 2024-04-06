import { Composer } from 'telegraf'
import { isChatMember } from '../index.js'
import { config } from '../config.js'
import saldoCommands from './saldo.js'

const bot = new Composer()

const adminMiddleware = bot.use(async (ctx, next) => {
  if (!ctx.from) {
    return
  }
  if (!(await isChatMember(ctx.from.id, config.adminChatId))) {
    return ctx.reply('sii dej i reven, pleb!')
  }
  await next()
})

export default Composer.compose([adminMiddleware, saldoCommands])
