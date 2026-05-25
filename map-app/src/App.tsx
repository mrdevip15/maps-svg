import InteractiveMap from "./components/InteractiveMap";
import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Peta Interaktif Indonesia</h1>
        <p className="subtitle">
          Sulawesi, Maluku & Papua — Arahkan kursor ke provinsi untuk melihat
          data populasi
        </p>
      </header>

      <main className="map-wrapper">
        <InteractiveMap />
      </main>

      <footer className="footer">
        <span>Data populasi: BPS 2020 (estimasi)</span>
      </footer>
    </div>
  );
}

export default App;
