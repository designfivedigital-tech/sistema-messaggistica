import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main>
      <h1>Pagina non trovata</h1>
      <Link to="/login">Torna all'accesso</Link>
    </main>
  );
}