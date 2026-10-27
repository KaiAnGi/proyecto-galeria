import { HashRouter, Route, Routes } from 'react-router-dom'
import SaveStatus from './components/SaveStatus'
import TrashUndoBar from './components/TrashUndoBar'
import Home from './app/Home'
import Gallery from './app/Gallery'
import ObraDetail from './app/ObraDetail'
import Colecciones from './app/Colecciones'
import ColeccionDetail from './app/ColeccionDetail'
import PencilTest from './app/PencilTest'
import Entregas from './app/Entregas'

function App() {
  return (
    <HashRouter>
      <SaveStatus />
      <TrashUndoBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/galeria" element={<Gallery />} />
        <Route path="/obra/:id" element={<ObraDetail />} />
        <Route path="/colecciones" element={<Colecciones />} />
        <Route path="/coleccion/:id" element={<ColeccionDetail />} />
        <Route path="/pencil-test" element={<PencilTest />} />
        <Route path="/entregas" element={<Entregas />} />
      </Routes>
    </HashRouter>
  )
}

export default App
