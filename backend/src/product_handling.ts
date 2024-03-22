import { Scenes } from 'telegraf'
import { ProductIn, addProduct } from './products.js'

interface MyWizardSession extends Scenes.WizardSessionData {
  // available in scene context under ctx.scene.session.product
  product: ProductIn
}

export type MyContext = Scenes.WizardContext<MyWizardSession>;

export const addProductScene = new Scenes.WizardScene<MyContext>(
  'add_product_scene',
  async (ctx: MyContext) => {
    ctx.reply('Produkt namn?')
    ctx.scene.session.product = {name: '', description: '', priceCents: ''}
    return ctx.wizard.next()
  },
  async (ctx: MyContext) => {
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.product.name = ctx.message.text
      ctx.reply('Produkt description?')
      return ctx.wizard.next()
    } else{
      ctx.reply("Du måst skriva en text")
    }
    
    
  },
  async (ctx: MyContext) => {
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.product.description = ctx.message.text
      ctx.reply('Produktens pris (i positiva cent)?')
      return ctx.wizard.next()
    } else{
      ctx.reply("Du måst skriva en text")
    }
  },
  async (ctx: MyContext) => {

    // ctx.scene.session.product.priceCents = ctx.message.text
    // console.log(ctx.scene.session.product)
    if (ctx.message && 'text' in ctx.message) {
      if (Number(ctx.message.text) < 0) {
        return ctx.reply(
          'Priset måste vara positivt, det läggs sedan in i databasen som negativt!'
        )
      }
      ctx.scene.session.product.priceCents = ctx.message.text
      console.log(ctx.scene.session.product)
      const product = {
        name: ctx.scene.session.product.name,
        description: ctx.scene.session.product.description,
        priceCents: `-`+ctx.scene.session.product.priceCents
      }
      await addProduct(product)
      return ctx.scene.leave()
    } else{
      ctx.reply("Du måst skriva en text")
    }
    
  }
)

export const stage = new Scenes.Stage([addProductScene])
