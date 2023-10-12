import "dotenv/config"
import { Telegraf } from "telegraf"

const bot = new Telegraf(process.env.BOT_TOKEN as string)
bot.command('oldschool', (ctx) => ctx.reply('Hello'))
bot.command('hipster', Telegraf.reply('λ'))
bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

