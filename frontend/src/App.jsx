import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Graph from "./pages/Graph";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/graph/:owner/:repo" element={<Graph />} />
      <Route path="/:owner/:repo" element={<Graph />} />
    </Routes>
  );
}

export default App;
