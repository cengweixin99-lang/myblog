import { Link } from 'react-router-dom';
import "../styles/App.css"
import profileImg from '../assets/profile.jpg'
function Header() {
  const navItems = ['Home', 'Top', 'About', 'Things I like', "Things I don't like"];
  const route = ['/', '/top', '/post/101', '/post/102', '/post/103'];
  return (
    <>
      <hr/>
      <header className="header">
        <div className="header-row">
          <div className="profile-section">
            <div className='profile'>
              <img src= { profileImg }></img>
            </div>
            <p className="profile-content">People die,but what we do lives on. </p>
          </div>
          <div className="header-content">
            <nav className="nav">
              <ul className="nav-list">
                {navItems.map((item, index) => (
                  <li key={index}>
                    <Link to={route[index]} className="hover-underline-animation">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </header>
    </>
  )
}

export default Header
