import { HashRouter, Route, Routes } from 'react-router-dom'
import Home from './app/Home'
import Gallery from './app/Gallery'
import ObraDetail from './app/ObraDetail'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/galeria" element={<Gallery />} />
        <Route path="/obra/:id" element={<ObraDetail />} />
      </Routes>
    </HashRouter>
  )
}

export default App
