import Header from './components/Header'
import Footer from './components/Footer'
import { Outlet, useLocation } from 'react-router-dom'
import './styles/App.css'

function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  return (
    <div className="app page-layout">
      {!isAdmin && <Header />}
      <Outlet />
      {!isAdmin && <Footer />}
    </div>
  )
}

export default App
