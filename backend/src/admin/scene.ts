import { Scenes } from 'telegraf'
import { Product, ProductIn } from '../products.js'
import { TransactionInsert } from '../transactions.js'

interface MyWizardSession extends Scenes.WizardSessionData {
  // available in scene context under ctx.scene.session
  newProduct: ProductIn
  product: Product
  transactions: TransactionInsert[]
}

export type ContextWithScenes = Scenes.WizardContext<MyWizardSession>
