//#region Imports & Init
import { Composer, Markup, Scenes } from 'telegraf'
import {
  Product,
  ProductIn,
  addProduct,
  deleteProduct,
  editProduct,
  getProductById,
  getProducts,
} from '../products.js'
import { confirmOrAbortButton, formatButtonArray } from '../utils.js'
import { ContextWithScenes } from '../scene.js'

const bot = new Composer<ContextWithScenes>()

export const productsToArray = async (): Promise<Product[]> => {
  const productQuery = await getProducts()
  return productQuery.rows.map(({ id, name, description, price_cents }) => {
    return {
      id,
      name,
      description,
      price_cents,
    }
  }) as Product[]
}

const skipButtonKeyboard = Markup.inlineKeyboard([
  Markup.button.callback('Skip (värdet uppdateras inte)', 'skip'),
])

//endregion

//#region Delete
const deleteCommand = bot.command('delete_product', async (ctx) => {
  const products = await productsToArray()
  const priceList = products.map(({ description, price_cents }) => {
    return `\n${description} - ${Number(price_cents) / -100}€`
  })
  const keyboard_array = products.map(({ id, description }) => {
    return Markup.button.callback(
      description,
      `delete_productname_${id}_${description}`
    )
  })

  const abortButton = Markup.button.callback(
    'Avbryt',
    'delete_productname_abort'
  )

  return ctx.reply(`Vilken produkt vill du ta bort?${priceList}`, {
    ...Markup.inlineKeyboard(
      formatButtonArray([...keyboard_array, abortButton])
    ),
  })
})

const deleteCommandFollowUp = bot.action(
  /delete_productname_(\d*)_(.*)/,
  async (ctx) => {
    const productId = Number(ctx.match[1])
    const productDescription = ctx.match[2]
    try {
      const deletedRowsCount = (await deleteProduct(productId))['rowCount']
      if (deletedRowsCount > 1) {
        console.log(
          `${deletedRowsCount} rows were deleted, only 1 should have been.`
        )
      }
      console.log(
        `Removed product with id ${productId} and description "${productDescription}"`
      )
      return ctx.editMessageText(
        `Raderingen av produkt "${productDescription}" lyckades!`
      )
    } catch (e) {
      console.log(
        `Failed to remove product with id ${productId} and description "${productDescription}"`,
        e
      )
      return ctx.editMessageText(
        `Raderingen av produkt ${productId} misslyckades! Klaga till nån!`
      )
    }
  }
)

const deleteCommandAbort = bot.action(
  'delete_productname_abort',
  async (ctx) => {
    return ctx.editMessageText('Raderingen av produkter avbröts')
  }
)
//#endregion

//#region Add

const addProductScene = new Scenes.WizardScene<ContextWithScenes>(
  'add_product_scene',
  async (ctx) => {
    ctx.reply('Produktens namn? Endast a-z & 0-9 är tillåtna')
    ctx.scene.session.newProduct = {
      name: '',
      description: '',
      priceCents: '',
    }
    return ctx.wizard.next()
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.newProduct.name = ctx.message.text
        .replace(/[\W_]+/g, '')
        .toLowerCase()
      ctx.reply('Produktens beskrivning?')
      return ctx.wizard.next()
    } else {
      ctx.reply('Du måst skriva en text')
    }
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.newProduct.description = ctx.message.text
      ctx.reply('Produktens pris (i positiva cent)?')
      return ctx.wizard.next()
    } else {
      ctx.reply('Du måst skriva en text')
    }
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      if (Number(ctx.message.text) < 0 || isNaN(Number(ctx.message.text))) {
        return ctx.reply(
          'Priset måste vara positivt, det läggs sedan in i databasen som negativt!'
        )
      }
      ctx.scene.session.newProduct.priceCents = `-` + ctx.message.text

      const newProduct = ctx.scene.session.newProduct
      confirmOrAbortReplyForAdd(ctx, newProduct)
      return ctx.wizard.next()
    }
  },
  async (ctx) => {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      ctx.editMessageReplyMarkup(undefined)
      const decision = ctx.callbackQuery.data
      if (decision === 'confirm') {
        const product = {
          name: ctx.scene.session.newProduct.name,
          description: ctx.scene.session.newProduct.description,
          priceCents: ctx.scene.session.newProduct.priceCents,
        }
        try {
          await addProduct(product)
          console.log(
            'The following product has been added:\n' +
              `name:"${ctx.scene.session.newProduct.name}"\n` +
              `description:"${ctx.scene.session.newProduct.description}"\n` +
              `priceCents:"${ctx.scene.session.newProduct.priceCents}"\n`
          )
          ctx.reply(
            'Produkten har lagts till!\n' +
              'För att den nya produkten ska synas i menyn måste botten startas om.'
          )
        } catch (e) {
          console.log(
            'The following product could not be added:\n' +
              `name:"${ctx.scene.session.newProduct.name}"\n` +
              `description:"${ctx.scene.session.newProduct.description}"\n` +
              `priceCents:"${ctx.scene.session.newProduct.priceCents}"\n`,
            e
          )
        }
        return ctx.scene.leave()
      } else if (decision === 'abort') {
        ctx.reply('Tillägning av produkt avbruten.')
        return ctx.scene.leave()
      }
    } else {
      ctx.reply('Du måst trycka på endera alternativ')
    }
  }
)

function confirmOrAbortReplyForAdd(ctx: ContextWithScenes, product: ProductIn) {
  ctx.reply(
    `Följande product kommer att läggas till:\n` +
      `\t${product.name}\n` +
      `\t${product.description}\n` +
      `\t${-product.priceCents}\n`,
    {
      ...confirmOrAbortButton,
    }
  )
}

//#endregion

//#region Edit

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
      ctx.editMessageReplyMarkup(undefined)
      const productId = Number(ctx.callbackQuery.data)
      ctx.scene.session.product = (await getProductById(productId)).rows[0]
      ctx.reply(
        `Produktens nya namn? Nu heter produkten "${ctx.scene.session.product.name}"`,
        {
          ...skipButtonKeyboard,
        }
      )
      return ctx.wizard.next()
    }
    ctx.reply('Välj en produkt från knapparna!')
  },
  async (ctx) => {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      if (ctx.callbackQuery.data === 'skip') {
        ctx.editMessageReplyMarkup(undefined)
        ctx.reply(
          `Produktens nya beskrivning? Nu har den beskrviningen "${ctx.scene.session.product.description}"`,
          {
            ...skipButtonKeyboard,
          }
        )
        return ctx.wizard.next()
      }
    }
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.product.name = ctx.message.text
      ctx.reply(
        `Produktens nya beskrivning? Nu har den beskrviningen "${ctx.scene.session.product.description}"`,
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
        ctx.editMessageReplyMarkup(undefined)
        ctx.reply(
          `Produktens nya pris (i positiva cent)? Nu är det ${-ctx.scene.session
            .product.price_cents}`,
          {
            ...skipButtonKeyboard,
          }
        )
        return ctx.wizard.next()
      }
    }
    if (ctx.message && 'text' in ctx.message) {
      ctx.scene.session.product.description = ctx.message.text
      ctx.reply(
        `Produktens nya pris (i positiva cent)? Nu är det ${-ctx.scene.session
          .product.price_cents}`,
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
        ctx.editMessageReplyMarkup(undefined)
        const updatedProduct = ctx.scene.session.product
        await confirmOrAbortButtonForEdit(ctx, updatedProduct)

        return ctx.wizard.next()
      }
    } else if (ctx.message && 'text' in ctx.message) {
      if (Number(ctx.message.text) < 0) {
        return ctx.reply(
          'Priset måste vara positivt, det läggs sedan in i databasen som negativt!'
        )
      }
      ctx.scene.session.product.price_cents = `-` + ctx.message.text

      const updatedProduct = ctx.scene.session.product

      await confirmOrAbortButtonForEdit(ctx, updatedProduct)

      return ctx.wizard.next()
    } else {
      ctx.reply('Du måst skriva en text')
    }
  },
  async (ctx) => {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      ctx.editMessageReplyMarkup(undefined)
      const decision = ctx.callbackQuery.data
      if (decision === 'confirm') {
        try {
          await editProduct(ctx.scene.session.product)
          console.log(
            `Product "${ctx.scene.session.product.name}" with id ${ctx.scene.session.product.id} has been updated!`
          )
          ctx.reply('Produkten har uppdaterats!')
        } catch (e) {
          ctx.reply('Produkten kunde inte uppdaterats!')
          console.log(
            `Product "${ctx.scene.session.product.name}" with id ${ctx.scene.session.product.id} could not be edited:`,
            e
          )
        }
        return ctx.scene.leave()
      } else if (decision === 'abort') {
        ctx.reply('Uppdatering av produkten avbruten.')
        return ctx.scene.leave()
      }
    } else {
      ctx.reply('Du måst trycka på endera alternativ')
    }
  }
)

async function confirmOrAbortButtonForEdit(
  ctx: ContextWithScenes,
  product: Product
) {
  const originalProduct = (await getProductById(product.id)).rows[0]
  ctx.reply(
    `Följande product kommer att uppdateras:\n` +
      `\t\t\tKommando: ${originalProduct.name} --> ${product.name}\n` +
      `\t\t\tFörklaring: ${originalProduct.description} --> ${product.description}\n` +
      `\t\t\tPris: ${-originalProduct.price_cents} --> ${-product.price_cents}\n`,
    {
      ...confirmOrAbortButton,
    }
  )
}

//#endregion

//#region Misc & Export

const stage = new Scenes.Stage([addProductScene, editProductScene])
bot.use(stage.middleware())

const addCommand = bot.command('add_product', async (ctx) => {
  await ctx.scene.enter('add_product_scene')
})

const editCommand = bot.command('edit_product', async (ctx) => {
  await ctx.scene.enter('edit_product_scene')
})

export default Composer.compose([
  addCommand,
  editCommand,
  deleteCommand,
  deleteCommandFollowUp,
  deleteCommandAbort,
])

//#endregion
