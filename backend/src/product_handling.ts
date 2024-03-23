import { Composer, Markup, Scenes } from 'telegraf'
import {
  Product,
  ProductIn,
  addProduct,
  deleteProduct,
  editProduct,
  getProductById,
  getProducts,
} from './products.js'
import { formatButtonArray } from './index.js'

interface MyWizardSession extends Scenes.WizardSessionData {
  // available in scene context under ctx.scene.session
  product_new: ProductIn
  product_edit: Product
}

export type ContextWithScenes = Scenes.WizardContext<MyWizardSession>

const bot = new Composer<ContextWithScenes>()

export const productsToArray = async (): Promise<Product[]> => {
  const productQuery = getProducts()
  const res: Product[] = (await productQuery).rows.map(
    ({ id, name, description, price_cents }) => {
      return {
        id,
        name,
        description,
        price_cents,
      }
    }
  )
  return res
}


const deleteCommand = bot.command('delete_product', async (ctx) => {
  const products = await productsToArray()
  const priceList = products.map(({ description, price_cents }) => {
    return `\n${description} - ${Number(price_cents) / -100}€`
  })
  const keyboard_array = formatButtonArray(
    products.map(({ id, description }) => {
      return Markup.button.callback(
        description,
        `delete_productname_${id}_${description}`
      )
    })
  )

  return ctx.reply(`Vilken produkt vill du ta bort?${priceList}`, {
    ...Markup.inlineKeyboard(keyboard_array),
  })
})

const deleteCommandFollowUp =  bot.action(/delete_productname_(\d*)_(.*)/, async (ctx) => {
  const productId = Number(ctx.match[1])
  const productDescription = ctx.match[2]
  try {
    await deleteProduct(productId)
    console.log(
      `Removed product with id ${productId} and description "${productDescription}"`
    )
    return ctx.editMessageText(
      `Raderingen av product "${productDescription}" lyckades!`
    )
  } catch (e) {
    console.log(
      `Failed to remove product with id ${productId} and description "${productDescription}"`,
      e
    )
    return ctx.editMessageText(
      `Raderingen av product ${productId} misslyckades! Klaga till nån!`
    )
  }
})


const addProductScene = new Scenes.WizardScene<ContextWithScenes>(
  'add_product_scene',
  async (ctx) => {
    ctx.reply('Produkt namn? (Blir automatisk små bokstäver)')
    ctx.scene.session.product_new = {
      name: '',
      description: '',
      priceCents: '',
    }
    return ctx.wizard.next()
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.product_new.name = ctx.message.text.toLowerCase()
      ctx.reply('Produkt beskrivning?')
      return ctx.wizard.next()
    } else {
      ctx.reply('Du måst skriva en text')
    }
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.product_new.description = ctx.message.text
      ctx.reply('Produktens pris (i positiva cent)?')
      return ctx.wizard.next()
    } else {
      ctx.reply('Du måst skriva en text')
    }
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      if (Number(ctx.message.text) < 0) {
        return ctx.reply(
          'Priset måste vara positivt, det läggs sedan in i databasen som negativt!'
        )
      }
      ctx.scene.session.product_new.priceCents = `-` + ctx.message.text
      console.log(ctx.scene.session.product_new)
      const product = {
        name: ctx.scene.session.product_new.name,
        description: ctx.scene.session.product_new.description,
        priceCents: ctx.scene.session.product_new.priceCents,
      }
      try {
        await addProduct(product)
        console.log(
          'The following product has been added:\n' +
            `name:"${ctx.scene.session.product_new.name}"\n` +
            `description:"${ctx.scene.session.product_new.description}"\n` +
            `priceCents:"${ctx.scene.session.product_new.priceCents}"\n`
        )
        ctx.reply('Produkten har lagts till!')
      } catch (e) {
        console.log(
          'The following product could not be added:\n' +
            `name:"${ctx.scene.session.product_new.name}"\n` +
            `description:"${ctx.scene.session.product_new.description}"\n` +
            `priceCents:"${ctx.scene.session.product_new.priceCents}"\n`,
          e
        )
      }
      return ctx.scene.leave()
    } else {
      ctx.reply('Du måst skriva en text')
    }
  }
)

const skipButtonKeyboard = Markup.inlineKeyboard([
  Markup.button.callback('Skip (värdet uppdateras inte)', 'skip'),
])

const editProductScene = new Scenes.WizardScene<ContextWithScenes>(
  'edit_product_scene',
  async (ctx: ContextWithScenes) => {
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
  async (ctx) => {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      const productId = Number(ctx.callbackQuery.data)
      ctx.scene.session.product_edit = (await getProductById(productId)).rows[0]
      ctx.reply(
        `Produktens nya namn? Nu heter produkten "${ctx.scene.session.product_edit.name}"`,
        {
          ...skipButtonKeyboard,
        }
      )
      return ctx.wizard.next()
    }
    ctx.reply('Väl en produkt från knapparna!')
  },
  async (ctx) => {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      if (ctx.callbackQuery.data === 'skip') {
        ctx.reply(
          `Produktens nya beskrivning? Nu har den beskrviningen "${ctx.scene.session.product_edit.description}"`,
          {
            ...skipButtonKeyboard,
          }
        )
        return ctx.wizard.next()
      }
    }
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.product_edit.name = ctx.message.text
      ctx.reply(
        `Produktens nya beskrivning? Nu har den beskrviningen "${ctx.scene.session.product_edit.description}"`,
        {
          ...skipButtonKeyboard,
        }
      )
      return ctx.wizard.next()
    } else {
      ctx.reply('Du måst skriva en text')
    }
  },
  async (ctx) => {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      if (ctx.callbackQuery.data === 'skip') {
        ctx.reply(
          `Produktens nya pris (i positiva cent)? Nu är det ${-ctx.scene.session
            .product_edit.price_cents}`,
          {
            ...skipButtonKeyboard,
          }
        )
        return ctx.wizard.next()
      }
    }
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.product_edit.description = ctx.message.text
      ctx.reply(
        `Produktens nya pris (i positiva cent)? Nu är det ${-ctx.scene.session
          .product_edit.price_cents}`,
        {
          ...skipButtonKeyboard,
        }
      )
      return ctx.wizard.next()
    } else {
      ctx.reply('Du måst skriva en text')
    }
  },
  async (ctx) => {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      if (ctx.callbackQuery.data === 'skip') {
        try {
          await editProduct(ctx.scene.session.product_edit)
          console.log(
            `Product "${ctx.scene.session.product_edit.name}" with id ${ctx.scene.session.product_edit.id} has been updated!`
          )
          ctx.reply('Produkten har uppdaterats!')
        } catch (e) {
          ctx.reply('Produkten kunde inte uppdaterats!')
          console.log(
            `Product "${ctx.scene.session.product_edit.name}" with id ${ctx.scene.session.product_edit.id} could not be edited:`,
            e
          )
        }
        return ctx.scene.leave()
      }
    }
    if (ctx.message && 'text' in ctx.message) {
      if (Number(ctx.message.text) < 0) {
        return ctx.reply(
          'Priset måste vara positivt, det läggs sedan in i databasen som negativt!'
        )
      }
      ctx.scene.session.product_edit.price_cents = `-` + ctx.message.text
      try {
        await editProduct(ctx.scene.session.product_edit)
        console.log(
          `Product "${ctx.scene.session.product_edit.name}" with id ${ctx.scene.session.product_edit.id} has been updated!`
        )
        ctx.reply('Produkten har uppdaterats!')
      } catch (e) {
        ctx.reply('Produkten kunde inte uppdaterats!')
        console.log(
          `Product "${ctx.scene.session.product_edit.name}" with id ${ctx.scene.session.product_edit.id} could not be edited:`,
          e
        )
      }
      return ctx.scene.leave()
    } else {
      ctx.reply('Du måst skriva en text')
    }
  }
)



const stage = new Scenes.Stage([addProductScene, editProductScene])
bot.use(stage.middleware())

const addCommand = bot.command('add_product', async (ctx) => {
  await ctx.scene.enter('add_product_scene')
})

const editCommand = bot.command('edit_product', async (ctx) => {
  await ctx.scene.enter('edit_product_scene')
})

export default Composer.compose([addCommand, editCommand, deleteCommand, deleteCommandFollowUp])
