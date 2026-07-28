import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./App";
import { queryClient } from "./app/queryClient";
import { registerServiceWorker } from "./registerServiceWorker";

import "./index.css";

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "Elemento root non trovato.",
  );
}

registerServiceWorker();

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />

        <ReactQueryDevtools
          initialIsOpen={false}
        />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);