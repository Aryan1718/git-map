import Hero from "../components/Hero";
import Footer from "../components/Footer";
import GridDotsBackdrop from "../components/GridDotsBackdrop";

function Home() {
  return (
    <div className="relative overflow-hidden bg-surface text-slate-50">
      <GridDotsBackdrop />
      <main className="relative z-10">
        <Hero />
      </main>
      <Footer />
    </div>
  );
}

export default Home;
