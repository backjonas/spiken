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
  const admin_message = [
    'Följande admin kommandon existerar:',
    '/add_product För att lägga till en produkt',
    '/edit_product För att ändra en produkt',
    '/delete_product För att ta bort en produkt',
    '/exportera CSV-dump av alla transaktioner',
    '/historia_all Se de senaste händelserna för alla användare',
    '/saldo_all Se alla användares saldo',
    '/saldo_upload För att lägga till transaktioner manuellt',
    '/shame Skickar ett meddelande till alla med negativ saldo som påminner dem att betala. Lägg till _<nummer> för att endast pinga folk under -<nummer>.',
  ].join('\n')
  return ctx.reply(admin_message)
})

export default Composer.compose([
  adminMiddleware,
  saldoCommands,
  productCommands,
])
