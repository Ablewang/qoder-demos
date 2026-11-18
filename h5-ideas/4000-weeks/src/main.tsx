import { render } from 'preact'
import { App } from './App'
import { initStore } from './state/store'
import './styles.css'

render(<App />, document.getElementById('app')!)
void initStore()
