import InteractiveMap from "./components/InteractiveMap";
import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Peta Persebaran Cabang EAC</h1>
        <p className="subtitle">Ruangguru English Academic Center — Wilayah Indonesia Timur</p>
      </header>

      <main className="map-wrapper">
        <InteractiveMap />
      </main>

      <footer className="footer">
        <span>Data cabang EAC by Ruangguru</span>
      </footer>
    </div>
  );
}

export default App;
