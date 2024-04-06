import { Composer } from 'telegraf'
import { isChatMember } from '../index.js'
import { config } from '../config.js'
import saldoCommands from './saldo.js'
import productCommands from './product.js'

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

bot.command('admin', async (ctx) => {
  const admin_message =
    'Följande admin kommandon existerar:\n' +
    '/add_product För att lägga till en produkt\n' +
    '/edit_product För att ändra en produkt\n' +
    '/delete_product För att ta bort en produkt\n' +
    '/exportera CSV-dump av alla transaktioner\n' +
    '/historia_all Se de senaste händelserna för alla användare\n' +
    '/saldo_template Exportera template för att manuellt ändra på användares saldo\n'
  return ctx.reply(admin_message)
})

export default Composer.compose([
  adminMiddleware,
  saldoCommands,
  productCommands,
])
