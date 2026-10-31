import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import SaveStatus from './components/SaveStatus'
import TrashUndoBar from './components/TrashUndoBar'
import BackgroundTasksStatus from './components/BackgroundTasksStatus'
import Home from './app/Home'
import Gallery from './app/Gallery'
import ObraDetail from './app/ObraDetail'
import Colecciones from './app/Colecciones'
import ColeccionDetail from './app/ColeccionDetail'
import Animaciones from './app/Animaciones'
import AnimacionDetail from './app/AnimacionDetail'
import Entregas from './app/Entregas'

function App() {
  return (
    <HashRouter>
      <SaveStatus />
      <TrashUndoBar />
      <BackgroundTasksStatus />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/galeria" element={<Gallery />} />
        <Route path="/obra/:id" element={<ObraDetail />} />
        <Route path="/colecciones" element={<Colecciones />} />
        <Route path="/coleccion/:id" element={<ColeccionDetail />} />
        <Route path="/animaciones" element={<Animaciones />} />
        <Route path="/animaciones/:id" element={<AnimacionDetail />} />
        <Route path="/pencil-test" element={<Navigate to="/animaciones" replace />} />
        <Route path="/entregas" element={<Entregas />} />
      </Routes>
    </HashRouter>
  )
}

export default App
