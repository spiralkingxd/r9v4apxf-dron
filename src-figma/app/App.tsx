import "../styles/fonts.css";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { Tournaments } from "./components/Tournaments";
import { Ranking } from "./components/Ranking";
import { HowToJoin } from "./components/HowToJoin";
import { Gallery } from "./components/Gallery";
import { Contact } from "./components/Contact";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#060d1a" }}>
      <Navbar />
      <Hero />
      <About />
      <Tournaments />
      <Gallery />
      <Ranking />
      <HowToJoin />
      <Contact />
      <Footer />
    </div>
  );
}
