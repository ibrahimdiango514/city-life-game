import './ui/hud.css'
import { Game } from './Game'

const container = document.getElementById('app')
if (!container) {
  throw new Error('Élément #app introuvable dans le document.')
}

const game = new Game(container)
game.start()
