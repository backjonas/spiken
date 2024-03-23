import { Markup, Scenes } from 'telegraf'
import { Product, ProductIn, addProduct, editProduct, getProductById } from './products.js'
import { formatButtonArray, productsToArray } from './index.js';

interface MyWizardSession extends Scenes.WizardSessionData {
  // available in scene context under ctx.scene.session.product
  productIn: ProductIn
  productOut: Product
}

export type MyContext = Scenes.WizardContext<MyWizardSession>;

export const addProductScene = new Scenes.WizardScene<MyContext>(
  'add_product_scene',
  async (ctx: MyContext) => {
    ctx.reply('Produkt namn?')
    ctx.scene.session.productIn = {name: '', description: '', priceCents: ''}
    return ctx.wizard.next()
  },
  async (ctx: MyContext) => {
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.productIn.name = ctx.message.text
      ctx.reply('Produkt description?')
      return ctx.wizard.next()
    } else{
      ctx.reply("Du måst skriva en text")
    }
    
    
  },
  async (ctx: MyContext) => {
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.productIn.description = ctx.message.text
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
      ctx.scene.session.productIn.priceCents = `-`+ctx.message.text
      console.log(ctx.scene.session.productIn)
      const product = {
        name: ctx.scene.session.productIn.name,
        description: ctx.scene.session.productIn.description,
        priceCents: ctx.scene.session.productIn.priceCents
      }
      await addProduct(product)
      ctx.reply("Produkten har lagts till!")
      return ctx.scene.leave()
    } else{
      ctx.reply("Du måst skriva en text")
    }
    
  }
)

export const editProductScene = new Scenes.WizardScene<MyContext>(
  'edit_product_scene',
  async (ctx: MyContext) => {
    const products = await productsToArray()
    const priceList = products.map(({ description, price_cents }) => {
      return `\n${description} - ${Number(price_cents) / -100}€`
    })
    const keyboard_array = formatButtonArray(
      products.map(({ id, description }) => {
        return Markup.button.callback(description, String(id))
      })
    )
  
    await ctx.reply(`Vilken produkt vill du editera? ${priceList}`, {
      ...Markup.inlineKeyboard(keyboard_array),
    })
    return ctx.wizard.next()
  },
  async (ctx: MyContext) => {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      const productId = Number(ctx.callbackQuery.data)
      ctx.scene.session.productOut = (await getProductById(productId)).rows[0]
      ctx.reply(`Produktens nya namn? Nu heter produkten "${ctx.scene.session.productOut.name}"`)
      return ctx.wizard.next()
    }
    ctx.reply("Väl en produkt från knapparna!")
  },
  async (ctx: MyContext) => {
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.productOut.name = ctx.message.text
      ctx.reply(`Produktens nya beskrivning? Nu har den beskrviningen "${ctx.scene.session.productOut.description}"`)
      return ctx.wizard.next()
    } else{
      ctx.reply("Du måst skriva en text")
    }
    
    
  },
  async (ctx: MyContext) => {
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.productOut.description = ctx.message.text
      ctx.reply(`Produktens nya pris (i positiva cent)? Nu är det ${-ctx.scene.session.productOut.price_cents}`)
      return ctx.wizard.next()
    } else{
      ctx.reply("Du måst skriva en text")
    }
  },
  async (ctx: MyContext) => {
    if (ctx.message && 'text' in ctx.message) {
      if (Number(ctx.message.text) < 0) {
        return ctx.reply(
          'Priset måste vara positivt, det läggs sedan in i databasen som negativt!'
        )
      }
      ctx.scene.session.productOut.price_cents = `-`+ctx.message.text
      await editProduct(ctx.scene.session.productOut)
      ctx.reply("Produkten har uppdaterats!")
      return ctx.scene.leave()
    } else{
      ctx.reply("Du måst skriva en text")
    }
    
  }
)

export const stage = new Scenes.Stage([addProductScene, editProductScene])
