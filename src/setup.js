import { symlinkSync, existsSync, unlinkSync, mkdirSync } from 'fs'
import { resolve } from 'path'
//unlinkSync(resolve('./packages/node_modules/@bintoca'))
//unlinkSync(resolve('./packages/node_modules'))
if (!existsSync(resolve('./node_modules/@bintoca')) && !existsSync(resolve('./packages/node_modules'))) {
    mkdirSync(resolve('./packages/node_modules'))
    symlinkSync(resolve('./packages'), resolve('./packages/node_modules/@bintoca'), 'junction')
}